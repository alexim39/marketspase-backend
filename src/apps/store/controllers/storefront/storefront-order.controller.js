import axios from "axios";
import mongoose from "mongoose";
import { OrderModel, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS as ORDER_PAYMENT_STATUS } from "../../models/order/index.js";
import { PaymentModel, PAYMENT_GATEWAY, PAYMENT_STATUS as STORE_PAYMENT_STATUS } from "../../models/payment/index.js";
import { InventoryHistoryModel, ProductModel, PromotionTrackingModel } from "../../models/promotion/index.js";
import { StoreModel } from "../../models/store/index.js";
import { StoreCustomerModel } from "../../models/store-customer/index.js";
import { UserModel } from "../../../user/models/user/index.js";
import { sendEmail } from "../../../../core/email.service.js";
import {
  calculateCommissionForAmount,
  getProductAffiliateSettings,
  roundMoney
} from "../../services/storefront-affiliate.service.js";

const PAYSTACK_VERIFY_URL = "https://api.paystack.co/transaction/verify/";
const WALLET_TRANSACTION_LIMIT = 500;

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
    } = req.body;

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

    if (customerId && !mongoose.Types.ObjectId.isValid(customerId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const customer = customerId
      ? await UserModel.findById(customerId).session(session)
      : null;

    if (customerId && !customer) {
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
      currency: order.currency,
      transactionReference,
      paymentGateway: paymentMethod === PAYMENT_METHOD.PAYSTACK
        ? PAYMENT_GATEWAY.PAYSTACK
        : PAYMENT_GATEWAY.MANUAL,
      status: STORE_PAYMENT_STATUS.PENDING,
      customerEmail: buyerSnapshot.email,
      customerPhone: buyerSnapshot.phone,
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
        checkout: {
          amount: totalAmount,
          currency: order.currency,
          reference: transactionReference,
          marketerReservedAmount,
          promoterReservedAmount: totalPromoterCommission,
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

    const order = await OrderModel.findById(orderId).session(session);
    depopulateDocument(order, ['store', 'customer', 'items.product', 'items.promoterId']);

    if (!order || order.isDeleted) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (customerId && (!order.customer || toIdString(order.customer) !== customerId.toString())) {
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

    const verification = await verifyPaystackPayment(reference, order.totalAmount);
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

    sendStorefrontOrderEmail(populatedOrder || order, payment).catch((emailError) => {
      console.error("Storefront order email error:", emailError);
    });

    return res.status(200).json({
      success: true,
      message: "Payment confirmed and funds held in reserved balances",
      data: {
        order: populatedOrder,
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
    const { userId, role } = req.body;

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
    if (!confirmationRole) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Only the marketer, attributed promoter, or customer can confirm delivery",
      });
    }

    await releaseOrderEscrow(order, userId, confirmationRole, session);
    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Delivery confirmed and reserved funds released",
      data: {
        order,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Confirm storefront delivery error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to confirm delivery",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

export const getStorefrontOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.query;

    const order = await OrderModel.findById(orderId)
      .populate('store', 'name logo storeLink owner')
      .populate('customer', 'displayName username email')
      .populate('items.product', 'name images price')
      .populate('items.promoterId', 'displayName username');

    if (!order || order.isDeleted) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (userId && !canViewOrder(order, userId)) {
      return res.status(403).json({ success: false, message: "You are not allowed to view this order" });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Get storefront order error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch order" });
  }
};

export const getStoreOrders = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { userId, status, limit = 20, skip = 0 } = req.query;

    const store = await StoreModel.findById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }
    if (userId && store.owner.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "You are not allowed to view these orders" });
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

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
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

async function sendStorefrontOrderEmail(order, payment) {
  const buyer = getOrderBuyer(order);
  if (!buyer.email) return;

  const subject = `Your MarketSpase order ${order.orderNumber || ""} is confirmed`;
  await sendEmail(buyer.email, subject, buildStorefrontOrderEmail(order, payment, buyer));
}

function buildStorefrontOrderEmail(order, payment, buyer) {
  const storeName = order.store?.name || "MarketSpase Store";
  const rows = (order.items || []).map((item) => {
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

  return `
    <div style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#667eea;color:#ffffff;padding:24px;">
          <h1 style="margin:0;font-size:24px;">Order confirmed</h1>
          <p style="margin:8px 0 0;">Thanks ${escapeHtml(buyer.fullName || "there")}. Your payment has been received for ${escapeHtml(storeName)}.</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;">Order <strong>${escapeHtml(order.orderNumber || "")}</strong> is paid and held safely until delivery is confirmed.</p>
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
          <p style="color:#4b5563;margin:0;">The store will use your checkout details for delivery follow-up and order updates.</p>
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
      .populate('store', 'name logo storeLink')
      .populate('customer', 'displayName username email personalInfo')
      .populate('items.product', 'name images')
      .populate('items.promoterId', 'displayName username');
  } catch (error) {
    console.error("Fetch populated storefront order error:", error);
    return null;
  }
}

async function verifyPaystackPayment(reference, expectedAmount) {
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
    const verified = data?.status === "success" && paidAmount >= roundMoney(expectedAmount);

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

async function creditReservedWallet({ userId, walletRole, amount, reference, category, description, meta, session }) {
  const walletOwnerId = toObjectId(userId);
  if (!walletOwnerId || !amount || amount <= 0) return;

  await UserModel.updateOne(
    { _id: walletOwnerId },
    {
      $inc: { [`wallets.${walletRole}.reserved`]: roundMoney(amount) },
      $push: {
        [`wallets.${walletRole}.transactions`]: {
          $each: [{
            amount: roundMoney(amount),
            type: "credit",
            category,
            description,
            reference,
            gateway: "system",
            status: "reserved",
            meta,
            createdAt: new Date(),
          }],
          $position: 0,
          $slice: WALLET_TRANSACTION_LIMIT,
        },
      },
    },
    { session }
  );
}

async function releaseOrderEscrow(order, userId, confirmationRole, session) {
  const now = new Date();

  await moveReservedToBalance({
    userId: toObjectId(order.marketer),
    walletRole: "marketer",
    amount: order.marketerReservedAmount,
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

async function moveReservedToBalance({ userId, walletRole, amount, reference, category, description, meta, session }) {
  const walletOwnerId = toObjectId(userId);
  if (!walletOwnerId || !amount || amount <= 0) return;

  const user = await UserModel.findById(walletOwnerId).session(session);
  if (!user) throw new Error(`Wallet owner not found: ${walletOwnerId}`);

  const wallet = user.wallets?.[walletRole];
  if (!wallet) throw new Error(`Wallet not found for ${walletRole}`);

  const releaseAmount = roundMoney(amount);
  wallet.reserved = roundMoney(Math.max(0, (wallet.reserved || 0) - releaseAmount));
  wallet.balance = roundMoney((wallet.balance || 0) + releaseAmount);
  wallet.transactions.unshift({
    amount: releaseAmount,
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
