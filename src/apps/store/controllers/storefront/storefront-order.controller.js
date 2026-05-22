import axios from "axios";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { OrderModel, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS as ORDER_PAYMENT_STATUS } from "../../models/order/index.js";
import { PaymentModel, PAYMENT_GATEWAY, PAYMENT_STATUS as STORE_PAYMENT_STATUS } from "../../models/payment/index.js";
import { InventoryHistoryModel, ProductModel, PromotionTrackingModel } from "../../models/promotion/index.js";
import { StoreModel } from "../../models/store/index.js";
import { StoreCustomerModel } from "../../models/store-customer/index.js";
import { UserModel } from "../../../user/models/user/index.js";
import { evaluateUserBadges } from "../../../badges/service/badge.service.js";
import { awardGamificationProgress } from "../../../gamification/service/gamification.service.js";
import { sendEmail } from "../../../../core/email.service.js";
import {
  buildSignedQuote,
  convertAmount,
  getPaymentCurrencyConfig,
  normalizeCurrencyCode,
  verifySignedQuote,
} from "../../../wallet/services/payment-currency.service.js";
import {
  applyWalletCredit,
  ensureWalletCurrencyState,
  moveWalletReservedToBalance,
} from "../../../wallet/services/wallet-ledger.service.js";
import {
  calculateCommissionForAmount,
  getProductAffiliateSettings,
  roundMoney
} from "../../services/storefront-affiliate.service.js";
import { ensureStoreWriteAccess } from "../../services/store-authorization.service.js";

const PAYSTACK_VERIFY_URL = "https://api.paystack.co/transaction/verify/";
const WALLET_TRANSACTION_LIMIT = 500;
const ORDER_ACCESS_TOKEN_TTL = process.env.STOREFRONT_ORDER_ACCESS_TOKEN_TTL || "7d";

export const createStorefrontOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      customerId,
      productId,
      variantId,
      quantity = 1,
      trackingCode,
      ref,
      items,
      shippingAddress,
      customerNote,
      paymentMethod = PAYMENT_METHOD.PAYSTACK,
      checkoutCurrency,
      checkoutQuote,
    } = req.body;
    const authenticatedCustomerId = req.userId || null;
    const effectiveCustomerId = customerId || authenticatedCustomerId;

    const checkoutItems = Array.isArray(items) && items.length > 0
      ? items
      : [{ productId, variantId, quantity, trackingCode, ref }];

    const normalizedShippingAddress = normalizeShippingAddress(shippingAddress);
    const missingShippingFields = getMissingShippingFields(normalizedShippingAddress);

    if (!shippingAddress || checkoutItems.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "items/productId and shippingAddress are required",
      });
    }

    if (missingShippingFields.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Please provide ${missingShippingFields.join(", ")} for delivery and order updates`,
      });
    }

    if (checkoutItems.some((item) => !item.productId || !mongoose.Types.ObjectId.isValid(item.productId))) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Every checkout item must include a valid productId",
      });
    }

    if (effectiveCustomerId && !mongoose.Types.ObjectId.isValid(effectiveCustomerId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    if (customerId && authenticatedCustomerId && authenticatedCustomerId !== customerId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "You are not allowed to create an order for another signed-in customer",
      });
    }

    const customer = effectiveCustomerId
      ? await UserModel.findById(effectiveCustomerId).session(session)
      : null;

    if (effectiveCustomerId && !customer) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    let orderStore = null;
    let subtotal = 0;
    let totalPromoterCommission = 0;
    let currency = "NGN";
    const orderItems = [];

    for (const item of checkoutItems) {
      const product = await ProductModel.findOne({
        _id: item.productId,
        isActive: true,
        isDeleted: false,
        isPublished: true,
      }).session(session);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "One or more products are not available",
        });
      }

      const store = await StoreModel.findById(product.store).session(session);
      if (!store || store.isActive === false) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: "Store is not available" });
      }

      if (!orderStore) {
        orderStore = store;
        currency = product.currency || "NGN";
      } else if (orderStore._id.toString() !== store._id.toString()) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Checkout currently supports one store per order",
        });
      }

      const itemVariantId = item.variantId;
      const selectedVariant = itemVariantId
        ? product.variants?.id?.(itemVariantId) || product.variants?.find((variant) => variant._id?.toString() === itemVariantId)
        : null;

      const orderQuantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const unitPrice = selectedVariant?.price ?? product.price;
      const availableQuantity = selectedVariant ? selectedVariant.quantity : product.quantity;

      if (product.manageStock && availableQuantity < orderQuantity && !product.backorderAllowed) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      const itemSubtotal = roundMoney(unitPrice * orderQuantity);
      subtotal = roundMoney(subtotal + itemSubtotal);

      let promotion = null;
      const attributionCode = item.trackingCode || item.track || trackingCode || req.body.track;
      const attributionRef = item.ref || item.uniqueId || ref;
      if (attributionCode || attributionRef) {
        promotion = await PromotionTrackingModel.findOne({
          product: product._id,
          isActive: true,
          isApproved: true,
          $or: [
            ...(attributionCode ? [{ uniqueCode: attributionCode }] : []),
            ...(attributionRef ? [{ uniqueId: attributionRef }] : []),
          ],
        }).session(session);
      }

      const affiliateSettings = promotion
        ? {
            commissionType: promotion.commissionType,
            commissionRate: promotion.commissionRate,
            fixedCommission: promotion.fixedCommission,
          }
        : getProductAffiliateSettings(product);

      const commissionEarned = promotion
        ? calculateCommissionForAmount(itemSubtotal, affiliateSettings)
        : 0;
      totalPromoterCommission = roundMoney(totalPromoterCommission + commissionEarned);

      orderItems.push({
        product: product._id,
        variantId: selectedVariant?._id,
        variantName: selectedVariant?.name,
        quantity: orderQuantity,
        unitPrice,
        totalPrice: itemSubtotal,
        promotionTrackingId: promotion?._id,
        promoterId: promotion?.promoter,
        commissionEarned,
        trackingCode: attributionCode,
        trackingRef: attributionRef,
      });
    }

    const shippingFee = roundMoney(req.body.shippingFee || 0);
    const tax = roundMoney(req.body.tax || 0);
    const discount = roundMoney(req.body.discount || 0);
    const totalAmount = roundMoney(Math.max(0, subtotal + shippingFee + tax - discount));
    const marketerReservedAmount = roundMoney(totalAmount - totalPromoterCommission);
    const orderNumber = await OrderModel.generateOrderNumber();
    const firstAttribution = orderItems.find((item) => item.trackingCode || item.trackingRef) || {};
    const buyerSnapshot = buildBuyerSnapshot(customer, normalizedShippingAddress, req.body.guestCustomer || {}, firstAttribution);

    const normalizedCheckoutCurrency = normalizeCurrencyCode(checkoutCurrency || currency, currency);
    const paymentQuote = await (checkoutQuote
      ? verifySignedQuote(checkoutQuote, { purpose: 'storefront_checkout' })
      : buildSignedQuote({
          amount: totalAmount,
          fromCurrency: currency,
          toCurrency: normalizedCheckoutCurrency,
          purpose: 'storefront_checkout',
        }));

    if (normalizeCurrencyCode(paymentQuote.sourceCurrency, currency) !== normalizeCurrencyCode(currency, currency)
      || Math.abs(Number(paymentQuote.sourceAmount || 0) - totalAmount) > 1) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Checkout quote is no longer valid for the current order amount. Please refresh checkout.',
      });
    }

    const order = new OrderModel({
      orderNumber,
      store: orderStore._id,
      customer: customer?._id,
      customerType: customer ? "registered" : "guest",
      guestCustomer: customer ? undefined : buyerSnapshot,
      marketer: orderStore.owner,
      items: orderItems,
      subtotal,
      shippingFee,
      tax,
      discount,
      totalAmount,
      currency,
      checkoutCurrency: paymentQuote.targetCurrency,
      checkoutTotalAmount: paymentQuote.targetAmount,
      checkoutExchangeRate: paymentQuote.exchangeRate,
      shippingAddress: normalizedShippingAddress,
      paymentStatus: ORDER_PAYMENT_STATUS.PENDING,
      paymentMethod,
      orderStatus: ORDER_STATUS.PENDING,
      totalPromoterCommission,
      marketerReservedAmount,
      promoterReservedAmount: totalPromoterCommission,
      escrowStatus: "pending",
      customerNote,
    });

    await order.save({ session });

    const transactionReference = await PaymentModel.generateTransactionReference();
    const payment = new PaymentModel({
      order: order._id,
      store: orderStore._id,
      customer: customer?._id,
      amount: totalAmount,
      baseCurrency: currency,
      currency: order.currency,
      chargeAmount: paymentQuote.targetAmount,
      chargeCurrency: paymentQuote.targetCurrency,
      exchangeRate: paymentQuote.exchangeRate,
      transactionReference,
      paymentGateway: paymentMethod === PAYMENT_METHOD.PAYSTACK
        ? PAYMENT_GATEWAY.PAYSTACK
        : PAYMENT_GATEWAY.MANUAL,
      status: STORE_PAYMENT_STATUS.PENDING,
      customerEmail: buyerSnapshot.email,
      customerPhone: buyerSnapshot.phone,
      quoteSnapshot: paymentQuote,
    });

    await payment.save({ session });
    await recordStoreCustomerLead(order, session);
    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Order created. Complete payment to reserve funds.",
      data: {
        order,
        payment,
        orderAccessToken: signOrderAccessToken(order),
        checkout: {
          amount: paymentQuote.targetAmount,
          currency: paymentQuote.targetCurrency,
          reference: transactionReference,
          marketerReservedAmount,
          promoterReservedAmount: totalPromoterCommission,
          baseAmount: totalAmount,
          baseCurrency: order.currency,
          exchangeRate: paymentQuote.exchangeRate,
          quote: paymentQuote,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Create storefront order error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create storefront order",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

export const confirmStorefrontPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let transactionCommitted = false;
  let committedOrderId = null;

  try {
    const { orderId } = req.params;
    const { customerId, paymentReference, paystackResult } = req.body;
    const actorUserId = req.userId || customerId || null;

    const order = await OrderModel.findById(orderId).session(session);
    depopulateDocument(order, ['store', 'customer', 'items.product', 'items.promoterId']);

    if (!order || order.isDeleted) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.customer && !actorUserId) {
      await session.abortTransaction();
      return res.status(401).json({ success: false, message: "Authentication is required to confirm this payment" });
    }

    if (actorUserId && order.customer && toIdString(order.customer) !== actorUserId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: "You are not allowed to confirm this payment" });
    }

    if (order.paymentStatus === ORDER_PAYMENT_STATUS.PAID && ["held", "released"].includes(order.escrowStatus)) {
      await session.commitTransaction();
      transactionCommitted = true;
      const alreadyPaidOrder = await fetchPopulatedOrder(order._id);
      return res.status(200).json({
        success: true,
        message: "Payment already confirmed",
        data: { order: alreadyPaidOrder || order },
      });
    }

    const payment = await PaymentModel.findOne({ order: order._id }).session(session);
    depopulateDocument(payment, ['order', 'store', 'customer']);

    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    const reference = paymentReference || paystackResult?.reference || payment.transactionReference;
    if (reference !== payment.transactionReference) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Payment reference does not match this order" });
    }

    const verification = await verifyPaystackPayment(
      reference,
      payment.chargeAmount || order.checkoutTotalAmount || order.totalAmount,
      payment.chargeCurrency || order.checkoutCurrency || order.currency,
    );
    const localCallbackAccepted = process.env.NODE_ENV !== "production" && paystackResult?.status === "success";

    if (!verification.verified && !localCallbackAccepted) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: verification.message || "Payment could not be verified",
      });
    }

    await decrementInventory(order, session);
    await holdOrderEscrow(order, payment, verification.data || paystackResult || {}, session);

    await session.commitTransaction();
    transactionCommitted = true;
    committedOrderId = order._id;

    const populatedOrder = await fetchPopulatedOrder(order._id);

    recordStoreCustomer(populatedOrder || order).catch((customerError) => {
      console.error("Storefront customer capture error:", customerError);
    });

    sendStorefrontPaymentNotifications(populatedOrder || order, payment).catch((emailError) => {
      console.error("Storefront order notification error:", emailError);
    });

    const badgeUserIds = new Set();
    if ((populatedOrder || order)?.marketer) {
      badgeUserIds.add(toIdString((populatedOrder || order).marketer));
    }
    ((populatedOrder || order)?.items || []).forEach((item) => {
      if (item?.promoterId) {
        badgeUserIds.add(toIdString(item.promoterId));
      }
    });

    const gamificationAwards = [];
    if ((populatedOrder || order)?.marketer) {
      gamificationAwards.push(
        awardGamificationProgress({
          userId: toIdString((populatedOrder || order).marketer),
          actionKey: 'store_order_paid',
          sourceKey: `order:${order._id}:marketer_paid`,
          sourceType: 'store_order',
          sourceId: order._id,
          metadata: {
            orderId: order._id?.toString?.() || null,
            orderNumber: (populatedOrder || order).orderNumber || null,
            totalAmount: Number((populatedOrder || order).totalAmount || 0),
            marketerReservedAmount: Number((populatedOrder || order).marketerReservedAmount || 0),
          },
        })
      );
    }

    const promoterAwarded = new Set();
    ((populatedOrder || order)?.items || []).forEach((item) => {
      const promoterId = toIdString(item.promoterId);
      if (!promoterId || promoterAwarded.has(promoterId) || !Number(item.commissionEarned || 0)) {
        return;
      }

      promoterAwarded.add(promoterId);
      gamificationAwards.push(
        awardGamificationProgress({
          userId: promoterId,
          actionKey: 'affiliate_sale_paid',
          sourceKey: `order:${order._id}:promoter:${promoterId}:sale_paid`,
          sourceType: 'store_order',
          sourceId: order._id,
          metadata: {
            orderId: order._id?.toString?.() || null,
            orderNumber: (populatedOrder || order).orderNumber || null,
            totalAmount: Number(item.totalPrice || 0),
            commissionEarned: Number(item.commissionEarned || 0),
            productId: toIdString(item.product),
          },
        })
      );
    });

    await Promise.allSettled(gamificationAwards);

    await Promise.allSettled(
      [...badgeUserIds]
        .filter(Boolean)
        .map((id) => evaluateUserBadges(id, {
          force: true,
          trigger: 'storefront_payment_confirmed',
        }))
    );

    return res.status(200).json({
      success: true,
      message: "Payment confirmed and funds held in reserved balances",
      data: {
        order: populatedOrder,
        orderAccessToken: signOrderAccessToken(populatedOrder || order),
      },
    });
  } catch (error) {
    console.error("Confirm storefront payment error:", error);
    if (!transactionCommitted) {
      await safeAbortTransaction(session);
      return res.status(500).json({
        success: false,
        message: "Failed to confirm storefront payment",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }

    const populatedOrder = committedOrderId ? await fetchPopulatedOrder(committedOrderId) : null;
    return res.status(200).json({
      success: true,
      message: "Payment was confirmed, but post-payment details could not be fully refreshed",
      data: {
        order: populatedOrder,
      },
    });
  } finally {
    session.endSession();
  }
};

export const confirmStorefrontDelivery = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const {
      role,
      note,
      deliveryStatus = "delivered",
      buyerReceived = false,
    } = req.body;
    const userId = req.userId;

    if (!userId) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const order = await OrderModel.findById(orderId).session(session);
    depopulateDocument(order, ['store', 'customer', 'items.product', 'items.promoterId']);
    if (!order || order.isDeleted) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus !== ORDER_PAYMENT_STATUS.PAID || order.escrowStatus !== "held") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Only paid orders with held escrow can be released",
      });
    }

    const confirmationRole = resolveDeliveryConfirmationRole(order, userId, role);
    if (!confirmationRole || confirmationRole === "admin" || confirmationRole === "customer") {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Only the marketer or attributed promoter can request delivery release review",
      });
    }

    order.releaseRequest = {
      status: "requested",
      requestedBy: userId,
      requestedByRole: confirmationRole,
      requestedAt: new Date(),
      deliveryStatus,
      buyerReceived: Boolean(buyerReceived),
      note: normalizeString(note),
    };
    order.orderStatus = deliveryStatus === "shipped" ? ORDER_STATUS.SHIPPED : order.orderStatus;
    if (deliveryStatus === "delivered" || deliveryStatus === "received") {
      order.deliveredAt = order.deliveredAt || new Date();
    }

    await order.save({ session });
    await session.commitTransaction();

    const populatedOrder = await fetchPopulatedOrder(order._id);
    notifyAdminsOfReleaseRequest(populatedOrder || order).catch((emailError) => {
      console.error("Release request admin notification error:", emailError);
    });

    return res.status(200).json({
      success: true,
      message: "Delivery release request submitted for admin review",
      data: {
        order: populatedOrder || order,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Request storefront delivery release error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit delivery release request",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

export const reviewStorefrontDeliveryRelease = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { decision, note } = req.body;
    const adminId = req.userId;

    if (!adminId || !["approved", "rejected"].includes(decision)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "adminId and decision (approved/rejected) are required",
      });
    }

    const admin = await UserModel.findById(adminId).select("role email displayName username").session(session);
    if (!admin || admin.role !== "admin") {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: "Only admins can review release requests" });
    }

    const order = await OrderModel.findById(orderId).session(session);
    depopulateDocument(order, ['store', 'customer', 'items.product', 'items.promoterId']);
    if (!order || order.isDeleted) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus !== ORDER_PAYMENT_STATUS.PAID || order.escrowStatus !== "held") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Only paid orders with held escrow can be reviewed for release",
      });
    }

    if (order.releaseRequest?.status !== "requested") {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "This order has no pending release request" });
    }

    order.releaseRequest.reviewedBy = admin._id;
    order.releaseRequest.reviewedAt = new Date();
    order.releaseRequest.reviewNote = normalizeString(note);

    if (decision === "approved") {
      order.releaseRequest.status = "approved";
      await releaseOrderEscrow(order, admin._id, "admin", session);
    } else {
      order.releaseRequest.status = "rejected";
      await order.save({ session });
    }

    await session.commitTransaction();

    const populatedOrder = await fetchPopulatedOrder(order._id);
    sendReleaseReviewNotifications(populatedOrder || order, decision).catch((emailError) => {
      console.error("Release review notification error:", emailError);
    });

    return res.status(200).json({
      success: true,
      message: decision === "approved"
        ? "Funds released from reserve to balances"
        : "Release request rejected",
      data: { order: populatedOrder || order },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Review storefront delivery release error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to review delivery release request",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

export const getStorefrontReleaseRequests = async (req, res) => {
  try {
    const { status = "requested", limit = 30, skip = 0 } = req.query;

    const query = {
      isDeleted: false,
      paymentStatus: ORDER_PAYMENT_STATUS.PAID,
    };
    if (status && status !== "all") {
      query["releaseRequest.status"] = status;
    } else {
      query["releaseRequest.status"] = { $in: ["requested", "approved", "rejected"] };
    }

    const [orders, total] = await Promise.all([
      OrderModel.find(query)
        .populate('store', 'name logo storeLink owner')
        .populate('marketer', 'displayName username email')
        .populate('customer', 'displayName username email')
        .populate('items.product', 'name images price')
        .populate('items.promoterId', 'displayName username email')
        .populate('releaseRequest.requestedBy', 'displayName username email role')
        .populate('releaseRequest.reviewedBy', 'displayName username email role')
        .sort({ 'releaseRequest.requestedAt': -1, createdAt: -1 })
        .limit(parseInt(limit, 10))
        .skip(parseInt(skip, 10)),
      OrderModel.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          limit: parseInt(limit, 10),
          skip: parseInt(skip, 10),
          hasMore: parseInt(skip, 10) + orders.length < total,
        },
      },
    });
  } catch (error) {
    console.error("Get storefront release requests error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch release requests" });
  }
};

export const getStorefrontOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;
    const orderAccessToken = req.query.orderAccessToken || req.headers['x-order-access-token'];

    const order = await OrderModel.findById(orderId)
      .populate('store', 'name logo storeLink owner')
      .populate('customer', 'displayName username email')
      .populate('items.product', 'name images price')
      .populate('items.promoterId', 'displayName username');

    if (!order || order.isDeleted) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const canViewAsAdmin = req.user?.role === 'admin';
    const canViewAsAuthenticatedUser = Boolean(userId) && canViewOrder(order, userId);
    const canViewAsGuest = verifyOrderAccessToken(order, orderAccessToken);

    if (!canViewAsAdmin && !canViewAsAuthenticatedUser && !canViewAsGuest) {
      return res.status(403).json({ success: false, message: "You are not allowed to view this order" });
    }

    return res.status(200).json({
      success: true,
      data: order,
      orderAccessToken: signOrderAccessToken(order),
    });
  } catch (error) {
    console.error("Get storefront order error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch order" });
  }
};

export const getStoreOrders = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status, limit = 20, skip = 0 } = req.query;

    // Allow store owner (including legacy ownership formats) or admin to view store orders.
    try {
      await ensureStoreWriteAccess({ storeId, req, allowAdmin: true });
    } catch (authError) {
      const statusCode = authError.status || 403;
      return res.status(statusCode).json({
        success: false,
        message: statusCode === 404 ? "Store not found" : "You are not allowed to view these orders",
      });
    }

    const result = await OrderModel.findByStore(storeId, {
      status,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Get store orders error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch store orders" });
  }
};

export const getPromoterOrders = async (req, res) => {
  try {
    const { promoterId } = req.params;
    const { limit = 20, skip = 0, commissionPaid } = req.query;
    const userId = req.userId;

    if (req.user.role !== 'admin' && promoterId !== userId) {
      return res.status(403).json({ success: false, message: "You are not allowed to view these promoter orders" });
    }

    const result = await OrderModel.findByPromoter(promoterId, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
      commissionPaid: commissionPaid === undefined ? null : commissionPaid === "true",
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Get promoter orders error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch promoter orders" });
  }
};

export const getMarketerOrders = async (req, res) => {
  try {
    const { marketerId } = req.params;
    const { limit = 20, skip = 0, status, escrowStatus } = req.query;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(marketerId)) {
      return res.status(400).json({ success: false, message: "Invalid marketer ID" });
    }

    if (req.user.role !== 'admin' && marketerId !== userId) {
      return res.status(403).json({ success: false, message: "You are not allowed to view these marketer orders" });
    }

    const query = {
      marketer: marketerId,
      isDeleted: false,
    };
    if (status) query.orderStatus = status;
    if (escrowStatus) query.escrowStatus = escrowStatus;

    const [orders, total, stats] = await Promise.all([
      OrderModel.find(query)
        .populate('store', 'name logo storeLink owner')
        .populate('customer', 'displayName username email')
        .populate('items.product', 'name images price')
        .populate('items.promoterId', 'displayName username email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit, 10))
        .skip(parseInt(skip, 10)),
      OrderModel.countDocuments(query),
      OrderModel.aggregate([
        { $match: { marketer: new mongoose.Types.ObjectId(marketerId), isDeleted: false } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            reservedRevenue: {
              $sum: {
                $cond: [{ $eq: ['$escrowStatus', 'held'] }, '$marketerReservedAmount', 0]
              }
            },
            releasedRevenue: {
              $sum: {
                $cond: [{ $eq: ['$escrowStatus', 'released'] }, '$marketerReservedAmount', 0]
              }
            },
            pendingReleaseRequests: {
              $sum: {
                $cond: [{ $eq: ['$releaseRequest.status', 'requested'] }, 1, 0]
              }
            }
          }
        }
      ])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        orders,
        stats: stats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          reservedRevenue: 0,
          releasedRevenue: 0,
          pendingReleaseRequests: 0,
        },
        pagination: {
          total,
          limit: parseInt(limit, 10),
          skip: parseInt(skip, 10),
          hasMore: parseInt(skip, 10) + orders.length < total,
        },
      },
    });
  } catch (error) {
    console.error("Get marketer orders error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch marketer orders" });
  }
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function signOrderAccessToken(order) {
  if (!process.env.JWTTOKENSECRET || !order?._id) {
    return null;
  }

  return jwt.sign(
    {
      purpose: "storefront_order_access",
      orderId: order._id.toString(),
      email: normalizeString(order.guestCustomer?.email || order.shippingAddress?.email).toLowerCase(),
    },
    process.env.JWTTOKENSECRET,
    { expiresIn: ORDER_ACCESS_TOKEN_TTL }
  );
}

function verifyOrderAccessToken(order, token) {
  if (!token || !process.env.JWTTOKENSECRET || !order?._id) {
    return false;
  }

  try {
    const decoded = jwt.verify(String(token), process.env.JWTTOKENSECRET);
    if (decoded?.purpose !== "storefront_order_access") {
      return false;
    }

    if (decoded.orderId !== order._id.toString()) {
      return false;
    }

    const expectedEmail = normalizeString(order.guestCustomer?.email || order.shippingAddress?.email).toLowerCase();
    if (decoded.email && expectedEmail && decoded.email !== expectedEmail) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function normalizeShippingAddress(address = {}) {
  return {
    fullName: normalizeString(address.fullName),
    email: normalizeString(address.email).toLowerCase(),
    phone: normalizeString(address.phone),
    street: normalizeString(address.street),
    city: normalizeString(address.city),
    state: normalizeString(address.state),
    country: normalizeString(address.country) || "Nigeria",
    postalCode: normalizeString(address.postalCode),
  };
}

function getMissingShippingFields(address) {
  return [
    ["full name", address.fullName],
    ["email", address.email],
    ["phone number", address.phone],
    ["street address", address.street],
    ["city", address.city],
    ["state", address.state],
    ["country", address.country],
  ]
    .filter(([, value]) => !value)
    .map(([label]) => label);
}

function buildBuyerSnapshot(customer, shippingAddress, guestCustomer = {}, firstAttribution = {}) {
  const phone = shippingAddress.phone
    || normalizeString(guestCustomer.phone)
    || normalizeString(customer?.personalInfo?.phone)
    || normalizeString(customer?.personalInfo?.phoneDetails?.fullNumber);

  return {
    fullName: shippingAddress.fullName
      || normalizeString(guestCustomer.fullName)
      || normalizeString(customer?.displayName)
      || normalizeString(customer?.username),
    email: (shippingAddress.email || normalizeString(guestCustomer.email) || normalizeString(customer?.email)).toLowerCase(),
    phone,
    marketingOptIn: guestCustomer.marketingOptIn !== false,
    source: normalizeString(guestCustomer.source) || "storefront_checkout",
    firstTouchTrackingCode: normalizeString(firstAttribution.trackingCode),
    firstTouchRef: normalizeString(firstAttribution.trackingRef),
  };
}

function getOrderBuyer(order) {
  const shippingAddress = order.shippingAddress || {};
  const guestCustomer = order.guestCustomer || {};
  const populatedCustomer = order.customer && typeof order.customer === "object" ? order.customer : {};

  return {
    fullName: normalizeString(shippingAddress.fullName)
      || normalizeString(guestCustomer.fullName)
      || normalizeString(populatedCustomer.displayName)
      || normalizeString(populatedCustomer.username),
    email: (normalizeString(shippingAddress.email)
      || normalizeString(guestCustomer.email)
      || normalizeString(populatedCustomer.email)).toLowerCase(),
    phone: normalizeString(shippingAddress.phone)
      || normalizeString(guestCustomer.phone)
      || normalizeString(populatedCustomer.personalInfo?.phone)
      || normalizeString(populatedCustomer.personalInfo?.phoneDetails?.fullNumber),
    marketingOptIn: guestCustomer.marketingOptIn !== false,
  };
}

async function recordStoreCustomer(order, session) {
  const buyer = getOrderBuyer(order);
  const storeId = toObjectId(order.store);
  const customerId = toObjectId(order.customer);
  if (!buyer.email || !storeId) return;

  const firstAttribution = (order.items || []).find((item) => item.trackingCode || item.trackingRef) || {};
  const now = new Date();
  const setFields = {
    marketer: toObjectId(order.marketer),
    customerType: customerId ? "registered" : "guest",
    fullName: buyer.fullName,
    phone: buyer.phone,
    marketingOptIn: buyer.marketingOptIn,
    source: "storefront_checkout",
    lastTrackingCode: normalizeString(firstAttribution.trackingCode),
    lastTrackingRef: normalizeString(firstAttribution.trackingRef),
    lastOrder: order._id,
    lastOrderAt: now,
  };

  if (customerId) {
    setFields.customer = customerId;
  }

  const tags = ["storefront-buyer"];
  if (firstAttribution.trackingCode || firstAttribution.trackingRef) {
    tags.push("affiliate-linked");
  }

  await StoreCustomerModel.findOneAndUpdate(
    { store: storeId, email: buyer.email },
    {
      $setOnInsert: {
        store: storeId,
        email: buyer.email,
        firstOrder: order._id,
        firstSeenAt: now,
        firstTrackingCode: normalizeString(firstAttribution.trackingCode),
        firstTrackingRef: normalizeString(firstAttribution.trackingRef),
      },
      $set: setFields,
      $inc: {
        orderCount: 1,
        totalSpent: roundMoney(order.totalAmount || 0),
      },
      $addToSet: {
        tags: { $each: tags },
      },
    },
    { upsert: true, new: true, session }
  );
}

async function recordStoreCustomerLead(order, session) {
  const buyer = getOrderBuyer(order);
  const storeId = toObjectId(order.store);
  const customerId = toObjectId(order.customer);
  if (!buyer.email || !storeId) return;

  const firstAttribution = (order.items || []).find((item) => item.trackingCode || item.trackingRef) || {};
  const now = new Date();
  const setFields = {
    marketer: toObjectId(order.marketer),
    customerType: customerId ? "registered" : "guest",
    fullName: buyer.fullName,
    phone: buyer.phone,
    marketingOptIn: buyer.marketingOptIn,
    source: "storefront_checkout",
    lastTrackingCode: normalizeString(firstAttribution.trackingCode),
    lastTrackingRef: normalizeString(firstAttribution.trackingRef),
    lastOrder: order._id,
    lastOrderAt: now,
  };

  if (customerId) {
    setFields.customer = customerId;
  }

  const tags = ["storefront-lead"];
  if (firstAttribution.trackingCode || firstAttribution.trackingRef) {
    tags.push("affiliate-linked");
  }

  await StoreCustomerModel.findOneAndUpdate(
    { store: storeId, email: buyer.email },
    {
      $setOnInsert: {
        store: storeId,
        email: buyer.email,
        firstOrder: order._id,
        firstSeenAt: now,
        firstTrackingCode: normalizeString(firstAttribution.trackingCode),
        firstTrackingRef: normalizeString(firstAttribution.trackingRef),
      },
      $set: setFields,
      $addToSet: {
        tags: { $each: tags },
      },
    },
    { upsert: true, new: true, session }
  );
}

async function sendStorefrontPaymentNotifications(order, payment) {
  const buyer = getOrderBuyer(order);
  const emails = [];

  if (buyer.email) {
    emails.push(sendEmail(
      buyer.email,
      `Your MarketSpase order ${order.orderNumber || ""} is confirmed`,
      buildStorefrontOrderEmail(order, payment, buyer)
    ));
  }

  const marketer = getOrderMarketer(order);
  if (marketer?.email) {
    emails.push(sendEmail(
      marketer.email,
      `New storefront sale: ${order.orderNumber || "MarketSpase order"}`,
      buildMarketerSaleEmail(order, payment, buyer, marketer)
    ));
  }

  for (const promoter of getPromoterSaleRecipients(order)) {
    emails.push(sendEmail(
      promoter.email,
      `Affiliate sale recorded: ${order.orderNumber || "MarketSpase order"}`,
      buildPromoterSaleEmail(order, payment, promoter)
    ));
  }

  await Promise.all(emails);
}

function buildStorefrontOrderEmail(order, payment, buyer) {
  const storeName = order.store?.name || "MarketSpase Store";
  const rows = buildOrderRows(order);

  return `
    <div style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#667eea;color:#ffffff;padding:24px;">
          <h1 style="margin:0;font-size:24px;">Order confirmed</h1>
          <p style="margin:8px 0 0;">Thanks ${escapeHtml(buyer.fullName || "there")}. Your payment has been received for ${escapeHtml(storeName)}.</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;">Order <strong>${escapeHtml(order.orderNumber || "")}</strong> is paid and held safely until delivery is reviewed and approved by MarketSpase admin.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr>
                <th style="padding:12px;text-align:left;border-bottom:1px solid #e5e7eb;">Product</th>
                <th style="padding:12px;text-align:center;border-bottom:1px solid #e5e7eb;">Qty</th>
                <th style="padding:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Amount</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;"><strong>Total:</strong> ${formatMoney(order.totalAmount, order.currency)}</p>
            <p style="margin:0 0 8px;"><strong>Payment reference:</strong> ${escapeHtml(payment?.transactionReference || order.paymentReference || "")}</p>
            <p style="margin:0;"><strong>Delivery phone:</strong> ${escapeHtml(buyer.phone || order.shippingAddress?.phone || "")}</p>
          </div>
          <p style="color:#4b5563;margin:0 0 8px;">The store will use your checkout details for delivery follow-up and order updates.</p>
          <p style="color:#4b5563;margin:0;">When delivery is completed, MarketSpase will review the delivery release request before reserved funds are moved to the seller and promoter balances.</p>
        </div>
      </div>
    </div>
  `;
}

function buildMarketerSaleEmail(order, payment, buyer, marketer) {
  const rows = buildOrderRows(order);
  const address = order.shippingAddress || {};
  return `
    <div style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#111827;color:#ffffff;padding:24px;">
          <h1 style="margin:0;font-size:24px;">New storefront sale</h1>
          <p style="margin:8px 0 0;">Hello ${escapeHtml(marketer.displayName || marketer.username || "there")}, order ${escapeHtml(order.orderNumber || "")} is paid and ready for processing.</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;">Funds are now held in your reserved balance until delivery is vetted by MarketSpase admin.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr>
                <th style="padding:12px;text-align:left;border-bottom:1px solid #e5e7eb;">Product</th>
                <th style="padding:12px;text-align:center;border-bottom:1px solid #e5e7eb;">Qty</th>
                <th style="padding:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Amount</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;"><strong>Buyer:</strong> ${escapeHtml(buyer.fullName || "Customer")} (${escapeHtml(buyer.email || "")})</p>
            <p style="margin:0 0 8px;"><strong>Phone:</strong> ${escapeHtml(buyer.phone || "")}</p>
            <p style="margin:0 0 8px;"><strong>Delivery address:</strong> ${escapeHtml([address.street, address.city, address.state, address.country].filter(Boolean).join(", "))}</p>
            <p style="margin:0 0 8px;"><strong>Total paid:</strong> ${formatMoney(order.totalAmount, order.currency)}</p>
            <p style="margin:0;"><strong>Your reserved amount:</strong> ${formatMoney(order.marketerReservedAmount, order.currency)}</p>
          </div>
          <p style="color:#4b5563;margin:0;">Begin fulfilment and submit a delivery release request from your MarketSpase orders page after delivery is completed.</p>
        </div>
      </div>
    </div>
  `;
}

function buildPromoterSaleEmail(order, payment, promoter) {
  const items = promoter.items || [];
  const rows = items.map((item) => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
        <strong>${escapeHtml(item.product?.name || "Product")}</strong>
        ${item.trackingCode ? `<div style="color:#667eea;font-size:12px;margin-top:4px;">Tracking code: ${escapeHtml(item.trackingCode)}</div>` : ""}
      </td>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
      <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(item.commissionEarned, order.currency)}</td>
    </tr>
  `).join("");

  return `
    <div style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#16a34a;color:#ffffff;padding:24px;">
          <h1 style="margin:0;font-size:24px;">Your promotion made a sale</h1>
          <p style="margin:8px 0 0;">Nice work, ${escapeHtml(promoter.displayName || promoter.username || "there")}. A buyer purchased through your affiliate link.</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;">Your commission is held in reserved balance until delivery is reviewed by MarketSpase admin.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr>
                <th style="padding:12px;text-align:left;border-bottom:1px solid #e5e7eb;">Product</th>
                <th style="padding:12px;text-align:center;border-bottom:1px solid #e5e7eb;">Qty</th>
                <th style="padding:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Commission</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;"><strong>Order:</strong> ${escapeHtml(order.orderNumber || "")}</p>
            <p style="margin:0 0 8px;"><strong>Reserved commission:</strong> ${formatMoney(promoter.commission, order.currency)}</p>
            <p style="margin:0;"><strong>Payment reference:</strong> ${escapeHtml(payment?.transactionReference || order.paymentReference || "")}</p>
          </div>
          <p style="color:#4b5563;margin:0;">If you have proof that delivery has been completed, submit a release request from your affiliate sales page for admin review.</p>
        </div>
      </div>
    </div>
  `;
}

function buildOrderRows(order) {
  return (order.items || []).map((item) => {
    const productName = item.product?.name || "Product";
    const tracking = [
      item.trackingCode ? `Tracking code: ${escapeHtml(item.trackingCode)}` : "",
      item.trackingRef ? `Reference: ${escapeHtml(item.trackingRef)}` : "",
    ].filter(Boolean).join(" | ");

    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
          <strong>${escapeHtml(productName)}</strong>
          ${item.variantName ? `<div style="color:#6b7280;font-size:13px;">${escapeHtml(item.variantName)}</div>` : ""}
          ${tracking ? `<div style="color:#667eea;font-size:12px;margin-top:4px;">${tracking}</div>` : ""}
        </td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(item.totalPrice, order.currency)}</td>
      </tr>
    `;
  }).join("");
}

function getOrderMarketer(order) {
  if (order.marketer && typeof order.marketer === "object" && order.marketer.email) {
    return order.marketer;
  }
  if (order.store?.owner && typeof order.store.owner === "object" && order.store.owner.email) {
    return order.store.owner;
  }
  return null;
}

function getPromoterSaleRecipients(order) {
  const promoters = new Map();

  for (const item of order.items || []) {
    const promoter = item.promoterId;
    if (!promoter || typeof promoter !== "object" || !promoter.email || !item.commissionEarned) continue;

    const id = toIdString(promoter);
    const current = promoters.get(id) || {
      _id: promoter._id,
      displayName: promoter.displayName,
      username: promoter.username,
      email: promoter.email,
      commission: 0,
      items: [],
    };
    current.commission = roundMoney(current.commission + (item.commissionEarned || 0));
    current.items.push(item);
    promoters.set(id, current);
  }

  return Array.from(promoters.values());
}

async function notifyAdminsOfReleaseRequest(order) {
  const admins = await UserModel.find({ role: "admin", email: { $exists: true, $ne: "" } })
    .select("email displayName username")
    .lean();
  if (!admins.length) return;

  const requestedBy = order.releaseRequest?.requestedBy;
  const requesterName = typeof requestedBy === "object"
    ? requestedBy.displayName || requestedBy.username || requestedBy.email
    : order.releaseRequest?.requestedByRole || "A user";

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#7c3aed;color:#ffffff;padding:24px;">
          <h1 style="margin:0;font-size:24px;">Delivery release review needed</h1>
          <p style="margin:8px 0 0;">Order ${escapeHtml(order.orderNumber || "")} has a pending release request.</p>
        </div>
        <div style="padding:24px;">
          <p><strong>Requested by:</strong> ${escapeHtml(requesterName || "Requester")} (${escapeHtml(order.releaseRequest?.requestedByRole || "")})</p>
          <p><strong>Store:</strong> ${escapeHtml(order.store?.name || "MarketSpase Store")}</p>
          <p><strong>Order total:</strong> ${formatMoney(order.totalAmount, order.currency)}</p>
          <p><strong>Marketer reserved:</strong> ${formatMoney(order.marketerReservedAmount, order.currency)}</p>
          <p><strong>Promoter reserved:</strong> ${formatMoney(order.promoterReservedAmount, order.currency)}</p>
          ${order.releaseRequest?.note ? `<p><strong>Note:</strong> ${escapeHtml(order.releaseRequest.note)}</p>` : ""}
          <p style="color:#4b5563;margin:16px 0 0;">Please verify fulfilment evidence before approving fund release.</p>
        </div>
      </div>
    </div>
  `;

  await Promise.all(admins.map((admin) => sendEmail(
    admin.email,
    `Release review needed: ${order.orderNumber || "MarketSpase order"}`,
    html
  )));
}

async function sendReleaseReviewNotifications(order, decision) {
  const emails = [];
  const marketer = getOrderMarketer(order);
  const buyer = getOrderBuyer(order);
  const promoters = getPromoterSaleRecipients(order);
  const approved = decision === "approved";
  const subject = approved
    ? `Funds released for ${order.orderNumber || "your MarketSpase order"}`
    : `Release request rejected for ${order.orderNumber || "your MarketSpase order"}`;
  const html = buildReleaseReviewEmail(order, approved);

  if (marketer?.email) emails.push(sendEmail(marketer.email, subject, html));
  if (buyer.email) emails.push(sendEmail(buyer.email, subject, html));
  for (const promoter of promoters) {
    emails.push(sendEmail(promoter.email, subject, html));
  }

  await Promise.all(emails);
}

function buildReleaseReviewEmail(order, approved) {
  const statusCopy = approved
    ? "MarketSpase admin has approved the delivery review. Reserved funds have been released to the eligible balances."
    : "MarketSpase admin has reviewed the delivery request and rejected the release for now.";

  return `
    <div style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:${approved ? "#16a34a" : "#b91c1c"};color:#ffffff;padding:24px;">
          <h1 style="margin:0;font-size:24px;">${approved ? "Funds released" : "Release not approved"}</h1>
          <p style="margin:8px 0 0;">Order ${escapeHtml(order.orderNumber || "")}</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;">${statusCopy}</p>
          <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;"><strong>Order total:</strong> ${formatMoney(order.totalAmount, order.currency)}</p>
            <p style="margin:0 0 8px;"><strong>Marketer amount:</strong> ${formatMoney(order.marketerReservedAmount, order.currency)}</p>
            <p style="margin:0;"><strong>Promoter commission:</strong> ${formatMoney(order.promoterReservedAmount, order.currency)}</p>
          </div>
          ${order.releaseRequest?.reviewNote ? `<p><strong>Admin note:</strong> ${escapeHtml(order.releaseRequest.reviewNote)}</p>` : ""}
        </div>
      </div>
    </div>
  `;
}

function formatMoney(amount, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
    }).format(Number(amount || 0));
  } catch {
    return `${currency || "NGN"} ${Number(amount || 0).toLocaleString("en-NG")}`;
  }
}

function escapeHtml(value) {
  return normalizeString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toObjectId(value) {
  return value?._id || value;
}

function toIdString(value) {
  const raw = toObjectId(value);
  return raw?.toString?.() || "";
}

function depopulateDocument(doc, paths = []) {
  if (!doc || typeof doc.depopulate !== "function") return;
  for (const path of paths) {
    if (typeof doc.populated === "function" && doc.populated(path)) {
      doc.depopulate(path);
    }
  }
}

async function safeAbortTransaction(session) {
  try {
    await session.abortTransaction();
  } catch (abortError) {
    console.error("Storefront payment abort error:", abortError);
  }
}

async function fetchPopulatedOrder(orderId) {
  try {
    return await OrderModel.findById(orderId)
      .populate({
        path: 'store',
        select: 'name logo storeLink owner whatsappNumber',
        populate: { path: 'owner', select: 'displayName username email personalInfo' }
      })
      .populate('marketer', 'displayName username email personalInfo')
      .populate('customer', 'displayName username email personalInfo')
      .populate('items.product', 'name images price')
      .populate('items.promoterId', 'displayName username email')
      .populate('releaseRequest.requestedBy', 'displayName username email role')
      .populate('releaseRequest.reviewedBy', 'displayName username email role');
  } catch (error) {
    console.error("Fetch populated storefront order error:", error);
    return null;
  }
}

async function verifyPaystackPayment(reference, expectedAmount, expectedCurrency = 'NGN') {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return { verified: false, message: "Paystack secret key is not configured" };
  }

  try {
    const response = await axios.get(`${PAYSTACK_VERIFY_URL}${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      timeout: 15000,
    });

    const data = response.data?.data;
    const paidAmount = roundMoney((data?.amount || 0) / 100);
    const paidCurrency = normalizeCurrencyCode(data?.currency || expectedCurrency, expectedCurrency);
    const verified = data?.status === "success"
      && paidCurrency === normalizeCurrencyCode(expectedCurrency, expectedCurrency)
      && paidAmount >= roundMoney(expectedAmount);

    return {
      verified,
      data,
      message: verified ? "Payment verified" : "Payment amount or status does not match",
    };
  } catch (error) {
    return {
      verified: false,
      message: error.response?.data?.message || error.message || "Paystack verification failed",
    };
  }
}

async function decrementInventory(order, session) {
  for (const item of order.items) {
    const product = await ProductModel.findById(toObjectId(item.product)).session(session);
    if (!product) throw new Error("Product not found while updating inventory");

    let previousQuantity = product.quantity;
    let newQuantity = product.quantity;

    if (product.manageStock) {
      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (!variant) throw new Error("Selected product variant no longer exists");
        if (variant.quantity < item.quantity && !product.backorderAllowed) {
          throw new Error("Insufficient stock for selected variant");
        }
        previousQuantity = variant.quantity;
        variant.quantity = Math.max(0, variant.quantity - item.quantity);
        newQuantity = variant.quantity;
      } else {
        if (product.quantity < item.quantity && !product.backorderAllowed) {
          throw new Error("Insufficient stock for product");
        }
        previousQuantity = product.quantity;
        product.quantity = Math.max(0, product.quantity - item.quantity);
        newQuantity = product.quantity;
      }
    }

    product.purchaseCount = (product.purchaseCount || 0) + item.quantity;
    await product.save({ session });

    await InventoryHistoryModel.create([{
      product: product._id,
      variant: item.variantId,
      store: toObjectId(order.store),
      previousQuantity,
      newQuantity,
      changeAmount: -item.quantity,
      changeType: 'purchase',
      order: order._id,
      user: toObjectId(order.customer) || undefined,
      reason: 'Storefront purchase',
    }], { session });
  }
}

async function holdOrderEscrow(order, payment, gatewayPayload, session) {
  const now = new Date();

  payment.status = STORE_PAYMENT_STATUS.SUCCESS;
  payment.gatewayReference = gatewayPayload.reference || payment.transactionReference;
  payment.completedAt = now;
  payment.webhookPayload = gatewayPayload;
  await payment.save({ session });

  order.paymentStatus = ORDER_PAYMENT_STATUS.PAID;
  order.paymentReference = payment.transactionReference;
  order.paidAt = now;
  order.orderStatus = ORDER_STATUS.PROCESSING;
  order.processedAt = now;
  order.escrowStatus = "held";
  order.escrowHeldAt = now;
  await order.save({ session });

  await creditReservedWallet({
    userId: toObjectId(order.marketer),
    walletRole: "marketer",
    amount: order.marketerReservedAmount,
    currency: order.currency,
    reference: `${payment.transactionReference}-MKT-HOLD`,
    category: "store_sale",
    description: `Reserved storefront sale funds for order ${order.orderNumber}`,
    meta: { orderId: order._id, paymentId: payment._id, escrowStatus: "held" },
    session,
  });

  for (const [promoterId, amount] of getPromoterCommissionBreakdown(order)) {
    await creditReservedWallet({
      userId: promoterId,
      walletRole: "promoter",
      amount,
      currency: order.currency,
      reference: `${payment.transactionReference}-PRM-HOLD-${promoterId}`,
      category: "commission",
      description: `Reserved affiliate commission for order ${order.orderNumber}`,
      meta: { orderId: order._id, paymentId: payment._id, escrowStatus: "held" },
      session,
    });
  }

  await updateAffiliateConversions(order, session);
  await updateStoreSalesCounters(order, session);
}

async function creditReservedWallet({ userId, walletRole, amount, currency, reference, category, description, meta, session }) {
  const walletOwnerId = toObjectId(userId);
  if (!walletOwnerId || !amount || amount <= 0) return;
  const user = await UserModel.findById(walletOwnerId).session(session);
  if (!user) return;

  const wallet = user.wallets?.[walletRole];
  if (!wallet) return;

  ensureWalletCurrencyState(wallet, wallet.baseCurrency || wallet.currency || 'NGN');
  const config = await getPaymentCurrencyConfig();
  const nativeCurrency = normalizeCurrencyCode(currency || wallet.baseCurrency || 'NGN');
  const baseCurrency = normalizeCurrencyCode(wallet.baseCurrency || wallet.currency || 'NGN');
  const baseAmount = roundMoney(convertAmount(amount, nativeCurrency, baseCurrency, config).amount);

  applyWalletCredit(wallet, {
    bucket: 'reserved',
    amount,
    currency: nativeCurrency,
    baseAmount,
    baseCurrency,
  });

  wallet.transactions.unshift({
    amount: roundMoney(amount),
    baseAmount,
    currency: nativeCurrency,
    baseCurrency,
    settlementCurrency: nativeCurrency,
    settlementAmount: roundMoney(amount),
    exchangeRate: amount ? roundMoney(baseAmount / amount) : 1,
    type: "credit",
    category,
    description,
    reference,
    gateway: "system",
    status: "reserved",
    meta,
    createdAt: new Date(),
  });
  wallet.transactions = wallet.transactions.slice(0, WALLET_TRANSACTION_LIMIT);
  await user.save({ session });
}

async function releaseOrderEscrow(order, userId, confirmationRole, session) {
  const now = new Date();

  await moveReservedToBalance({
    userId: toObjectId(order.marketer),
    walletRole: "marketer",
    amount: order.marketerReservedAmount,
    currency: order.currency,
    reference: `${order.paymentReference}-MKT-RELEASE`,
    category: "store_sale",
    description: `Released storefront sale funds for order ${order.orderNumber}`,
    meta: { orderId: order._id, confirmedBy: userId, confirmationRole },
    session,
  });

  for (const [promoterId, amount] of getPromoterCommissionBreakdown(order)) {
    await moveReservedToBalance({
      userId: promoterId,
      walletRole: "promoter",
      amount,
      currency: order.currency,
      reference: `${order.paymentReference}-PRM-RELEASE-${promoterId}`,
      category: "commission",
      description: `Released affiliate commission for order ${order.orderNumber}`,
      meta: { orderId: order._id, confirmedBy: userId, confirmationRole },
      session,
    });
  }

  order.orderStatus = ORDER_STATUS.DELIVERED;
  order.deliveredAt = now;
  order.deliveredConfirmedBy = userId;
  order.deliveryConfirmedByRole = confirmationRole;
  order.deliveredConfirmedAt = now;
  order.escrowStatus = "released";
  order.escrowReleasedAt = now;
  order.commissionPaid = order.promoterReservedAmount > 0;
  order.commissionPaidAt = order.promoterReservedAmount > 0 ? now : undefined;
  await order.save({ session });
}

async function moveReservedToBalance({ userId, walletRole, amount, currency, reference, category, description, meta, session }) {
  const walletOwnerId = toObjectId(userId);
  if (!walletOwnerId || !amount || amount <= 0) return;

  const user = await UserModel.findById(walletOwnerId).session(session);
  if (!user) throw new Error(`Wallet owner not found: ${walletOwnerId}`);

  const wallet = user.wallets?.[walletRole];
  if (!wallet) throw new Error(`Wallet not found for ${walletRole}`);

  const releaseAmount = roundMoney(amount);
  ensureWalletCurrencyState(wallet, wallet.baseCurrency || wallet.currency || 'NGN');
  const config = await getPaymentCurrencyConfig();
  const nativeCurrency = normalizeCurrencyCode(currency || wallet.baseCurrency || 'NGN');
  const baseCurrency = normalizeCurrencyCode(wallet.baseCurrency || wallet.currency || 'NGN');
  const baseAmount = roundMoney(convertAmount(releaseAmount, nativeCurrency, baseCurrency, config).amount);
  moveWalletReservedToBalance(wallet, {
    amount: releaseAmount,
    currency: nativeCurrency,
    baseAmount,
    baseCurrency,
  });
  wallet.transactions.unshift({
    amount: releaseAmount,
    baseAmount,
    currency: nativeCurrency,
    baseCurrency,
    settlementCurrency: nativeCurrency,
    settlementAmount: releaseAmount,
    exchangeRate: releaseAmount ? roundMoney(baseAmount / releaseAmount) : 1,
    type: "credit",
    category,
    description,
    reference,
    gateway: "system",
    status: "completed",
    meta,
    processedAt: new Date(),
    createdAt: new Date(),
  });
  wallet.transactions = wallet.transactions.slice(0, WALLET_TRANSACTION_LIMIT);

  await user.save({ session });
}

function getPromoterCommissionBreakdown(order) {
  const totals = new Map();

  for (const item of order.items || []) {
    if (!item.promoterId || !item.commissionEarned || item.commissionEarned <= 0) continue;
    const promoterId = toIdString(item.promoterId);
    if (!promoterId) continue;
    totals.set(promoterId, roundMoney((totals.get(promoterId) || 0) + item.commissionEarned));
  }

  return totals.entries();
}

async function updateAffiliateConversions(order, session) {
  for (const item of order.items) {
    if (!item.promotionTrackingId || item.commissionEarned <= 0) continue;

    const promotion = await PromotionTrackingModel.findById(toObjectId(item.promotionTrackingId)).session(session);
    if (!promotion) continue;

    const previousConversions = promotion.conversionCount || 0;
    promotion.conversionCount = previousConversions + 1;
    promotion.earnings = roundMoney((promotion.earnings || 0) + item.commissionEarned);
    promotion.averageOrderValue = roundMoney(
      ((promotion.averageOrderValue || 0) * previousConversions + item.totalPrice) / promotion.conversionCount
    );
    promotion.conversionRate = promotion.clickCount > 0
      ? (promotion.conversionCount / promotion.clickCount) * 100
      : 0;
    promotion.lastActivityAt = new Date();
    await promotion.save({ session });
  }
}

async function updateStoreSalesCounters(order, session) {
  await StoreModel.findByIdAndUpdate(
    toObjectId(order.store),
    {
      $inc: {
        'analytics.totalSales': order.totalAmount,
        'analytics.promoterTraffic': order.totalPromoterCommission > 0 ? 1 : 0,
      },
    },
    { session }
  );
}

function resolveDeliveryConfirmationRole(order, userId, requestedRole) {
  const normalizedUserId = userId.toString();
  if (requestedRole === "admin") return "admin";
  if (toIdString(order.marketer) === normalizedUserId) return "marketer";
  if (order.items.some((item) => toIdString(item.promoterId) === normalizedUserId)) return "promoter";
  if (toIdString(order.customer) === normalizedUserId) return "customer";
  return null;
}

function canViewOrder(order, userId) {
  const normalizedUserId = userId.toString();
  return toIdString(order.customer) === normalizedUserId
    || toIdString(order.marketer) === normalizedUserId
    || order.items.some((item) => toIdString(item.promoterId) === normalizedUserId);
}
