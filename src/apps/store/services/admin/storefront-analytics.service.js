import mongoose from "mongoose";
import { OrderModel, ORDER_STATUS, PAYMENT_STATUS } from "../../models/order/index.js";
import { ProductModel } from "../../models/promotion/index.js";

const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 180;
const MAX_CATEGORY_PRODUCT_IDS = 20000;

const toInt = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
};

const clampDays = (value) => {
  const n = toInt(value, DEFAULT_RANGE_DAYS);
  return Math.min(MAX_RANGE_DAYS, Math.max(1, n));
};

const parseDateValue = (value) => {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const resolveAnalyticsRange = ({
  startDate,
  endDate,
  rangeDays,
  now = new Date(),
} = {}) => {
  const parsedStart = parseDateValue(startDate);
  const parsedEnd = parseDateValue(endDate);
  const days = clampDays(rangeDays);

  if (parsedStart || parsedEnd) {
    const end = endOfDay(parsedEnd || now);
    // Interpret rangeDays as an inclusive day count (e.g. 1 => today only).
    const start = startOfDay(parsedStart || new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000));
    return { start, end };
  }

  const end = endOfDay(now);
  // Interpret rangeDays as an inclusive day count (e.g. 7 => last 7 calendar days including today).
  const start = startOfDay(new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000));
  return { start, end };
};

const toObjectId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

const buildBaseOrderMatch = ({ start, end, storeId, buyerCountry, buyerState } = {}) => {
  const match = {
    isDeleted: { $ne: true },
    placedAt: { $gte: start, $lte: end },
  };

  if (storeId) {
    match.store = storeId;
  }

  if (buyerCountry) {
    match["shippingAddress.country"] = new RegExp(`^${escapeRegex(buyerCountry)}$`, "i");
  }

  if (buyerState) {
    match["shippingAddress.state"] = new RegExp(`^${escapeRegex(buyerState)}$`, "i");
  }

  return match;
};

const buildItemMatch = ({ productIds, promoterId } = {}) => {
  const match = {};
  if (Array.isArray(productIds) && productIds.length) {
    match["items.product"] = productIds.length === 1 ? productIds[0] : { $in: productIds };
  }
  if (promoterId) {
    match["items.promoterId"] = promoterId;
  }
  return match;
};

const buildBuyerKeyExpression = () => ({
  $ifNull: [
    { $toString: "$customer" },
    {
      $ifNull: ["$guestCustomer.email", { $ifNull: ["$shippingAddress.email", "$shippingAddress.phone"] }],
    },
  ],
});

const buildOrderSelectionPipeline = ({ baseMatch, itemMatch } = {}) => {
  const hasItemMatch = itemMatch && Object.keys(itemMatch).length > 0;

  if (!hasItemMatch) {
    return [
      { $match: baseMatch },
      {
        $addFields: {
          selectionRevenue: { $sum: "$items.totalPrice" },
          selectionUnits: { $sum: "$items.quantity" },
          selectionCommission: { $sum: "$items.commissionEarned" },
          selectionPromoters: { $setUnion: ["$items.promoterId", []] },
          buyerKey: buildBuyerKeyExpression(),
          buyerCountry: { $ifNull: ["$shippingAddress.country", ""] },
          buyerState: { $ifNull: ["$shippingAddress.state", ""] },
          referralSource: { $ifNull: ["$guestCustomer.source", "$customerType"] },
        },
      },
    ];
  }

  return [
    { $match: baseMatch },
    { $unwind: "$items" },
    { $match: itemMatch },
    {
      $group: {
        _id: "$_id",
        store: { $first: "$store" },
        customer: { $first: "$customer" },
        customerType: { $first: "$customerType" },
        guestCustomer: { $first: "$guestCustomer" },
        shippingAddress: { $first: "$shippingAddress" },
        orderNumber: { $first: "$orderNumber" },
        orderStatus: { $first: "$orderStatus" },
        paymentStatus: { $first: "$paymentStatus" },
        paymentMethod: { $first: "$paymentMethod" },
        escrowStatus: { $first: "$escrowStatus" },
        commissionPaid: { $first: "$commissionPaid" },
        paidAt: { $first: "$paidAt" },
        placedAt: { $first: "$placedAt" },
        deliveredAt: { $first: "$deliveredAt" },
        totalAmount: { $first: "$totalAmount" },
        currency: { $first: "$currency" },
        selectionRevenue: { $sum: "$items.totalPrice" },
        selectionUnits: { $sum: "$items.quantity" },
        selectionCommission: { $sum: "$items.commissionEarned" },
        selectionPromoters: { $addToSet: "$items.promoterId" },
        buyerKey: { $first: buildBuyerKeyExpression() },
        buyerCountry: { $first: { $ifNull: ["$shippingAddress.country", ""] } },
        buyerState: { $first: { $ifNull: ["$shippingAddress.state", ""] } },
        referralSource: { $first: { $ifNull: ["$guestCustomer.source", "$customerType"] } },
      },
    },
  ];
};

const reduceUniqueCount = (values) => Array.from(new Set((values || []).filter((v) => v !== null && v !== ""))).length;

const buildAlertSummary = (dailySeries = []) => {
  const points = Array.isArray(dailySeries) ? dailySeries : [];
  if (points.length < 3) return [];

  const last = points[points.length - 1];
  const prior = points.slice(Math.max(0, points.length - 8), points.length - 1);
  const avgRevenue = prior.reduce((sum, p) => sum + (Number(p.revenue || 0)), 0) / Math.max(1, prior.length);
  const avgOrders = prior.reduce((sum, p) => sum + (Number(p.orders || 0)), 0) / Math.max(1, prior.length);

  const alerts = [];
  if (avgRevenue > 0) {
    const change = (Number(last.revenue || 0) - avgRevenue) / avgRevenue;
    if (change >= 0.6) alerts.push(`Sales spike: +${Math.round(change * 100)}% vs prior 7-day avg`);
    if (change <= -0.6) alerts.push(`Sales drop: ${Math.round(change * 100)}% vs prior 7-day avg`);
  }

  if (avgOrders > 0) {
    const change = (Number(last.orders || 0) - avgOrders) / avgOrders;
    if (change >= 0.6) alerts.push(`Order spike: +${Math.round(change * 100)}% vs prior 7-day avg`);
    if (change <= -0.6) alerts.push(`Order drop: ${Math.round(change * 100)}% vs prior 7-day avg`);
  }

  return alerts;
};

export const getStorefrontAnalyticsOverview = async ({
  start,
  end,
  storeId,
  category,
  productId,
  promoterId,
  buyerCountry,
  buyerState,
  timezone = "Africa/Lagos",
  topLimit = 10,
} = {}) => {
  const storeObjectId = toObjectId(storeId);
  const promoterObjectId = toObjectId(promoterId);
  const productObjectId = toObjectId(productId);

  let categoryProductIds = null;
  if (!productObjectId && category) {
    const productQuery = {
      category: String(category || "").trim(),
    };
    if (storeObjectId) {
      productQuery.store = storeObjectId;
    }

    const ids = await ProductModel.find(productQuery).select("_id").limit(MAX_CATEGORY_PRODUCT_IDS + 1).lean();
    if (ids.length > MAX_CATEGORY_PRODUCT_IDS) {
      throw { status: 400, message: "Category filter too broad for analytics. Narrow to a store or product." };
    }
    categoryProductIds = ids.map((d) => d._id);
  }

  const productIds = productObjectId ? [productObjectId] : categoryProductIds;

  const baseMatch = buildBaseOrderMatch({
    start,
    end,
    storeId: storeObjectId,
    buyerCountry: buyerCountry ? String(buyerCountry).trim() : null,
    buyerState: buyerState ? String(buyerState).trim() : null,
  });
  const itemMatch = buildItemMatch({ productIds, promoterId: promoterObjectId });

  const selectionPipeline = buildOrderSelectionPipeline({ baseMatch, itemMatch });

  // Summary over selection (one doc per order).
  const summaryAgg = await OrderModel.aggregate([
    ...selectionPipeline,
    {
      $addFields: {
        isPaid: { $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] },
        isPending: { $and: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, { $in: ["$orderStatus", [ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED]] }] },
        isFulfilled: { $and: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, { $eq: ["$orderStatus", ORDER_STATUS.DELIVERED] }] },
        isRefunded: { $or: [{ $eq: ["$orderStatus", ORDER_STATUS.REFUNDED] }, { $in: ["$paymentStatus", [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED]] }] },
        paidRevenue: { $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$selectionRevenue", 0] },
        paidUnits: { $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$selectionUnits", 0] },
        paidCommission: { $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$selectionCommission", 0] },
        paidCommissionPaid: {
          $cond: [
            { $and: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, { $eq: ["$commissionPaid", true] }] },
            "$selectionCommission",
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        grossSales: { $sum: "$paidRevenue" },
        unitsSold: { $sum: "$paidUnits" },
        commissionAccrued: { $sum: "$paidCommission" },
        commissionPaid: { $sum: "$paidCommissionPaid" },
        totalOrders: { $sum: 1 },
        paidOrders: { $sum: { $cond: ["$isPaid", 1, 0] } },
        pendingOrders: { $sum: { $cond: ["$isPending", 1, 0] } },
        fulfilledOrders: { $sum: { $cond: ["$isFulfilled", 1, 0] } },
        refundedOrders: { $sum: { $cond: ["$isRefunded", 1, 0] } },
        buyerKeys: { $addToSet: "$buyerKey" },
        promoterArrays: { $push: "$selectionPromoters" },
        lastPaidAt: { $max: "$paidAt" },
      },
    },
    {
      $project: {
        _id: 0,
        grossSales: 1,
        unitsSold: 1,
        commissionAccrued: 1,
        commissionPaid: 1,
        commissionPending: { $max: [0, { $subtract: ["$commissionAccrued", "$commissionPaid"] }] },
        totalOrders: 1,
        paidOrders: 1,
        pendingOrders: 1,
        fulfilledOrders: 1,
        refundedOrders: 1,
        uniqueBuyers: { $size: "$buyerKeys" },
        promoterIds: {
          $reduce: {
            input: "$promoterArrays",
            initialValue: [],
            in: { $setUnion: ["$$value", { $ifNull: ["$$this", []] }] },
          },
        },
        lastPaidAt: 1,
      },
    },
  ]);

  const summary = summaryAgg?.[0] || {
    grossSales: 0,
    unitsSold: 0,
    commissionAccrued: 0,
    commissionPaid: 0,
    commissionPending: 0,
    totalOrders: 0,
    paidOrders: 0,
    pendingOrders: 0,
    fulfilledOrders: 0,
    refundedOrders: 0,
    uniqueBuyers: 0,
    promoterIds: [],
    lastPaidAt: null,
  };

  const uniquePromoters = reduceUniqueCount(summary.promoterIds);

  const averageOrderValue = summary.paidOrders > 0 ? Math.round((summary.grossSales / summary.paidOrders) * 100) / 100 : 0;

  // Daily sales trend (paid only).
  const dailySeries = await OrderModel.aggregate([
    ...buildOrderSelectionPipeline({ baseMatch: { ...baseMatch, paymentStatus: PAYMENT_STATUS.PAID }, itemMatch }),
    {
      $addFields: {
        bucket: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: { $ifNull: ["$paidAt", "$placedAt"] },
            timezone,
          },
        },
      },
    },
    {
      $group: {
        _id: "$bucket",
        revenue: { $sum: "$selectionRevenue" },
        orders: { $sum: 1 },
        units: { $sum: "$selectionUnits" },
        commission: { $sum: "$selectionCommission" },
      },
    },
    { $project: { _id: 0, bucket: "$_id", revenue: 1, orders: 1, units: 1, commission: 1 } },
    { $sort: { bucket: 1 } },
  ]);

  // Weekly trend (paid only).
  const weeklySeries = await OrderModel.aggregate([
    ...buildOrderSelectionPipeline({ baseMatch: { ...baseMatch, paymentStatus: PAYMENT_STATUS.PAID }, itemMatch }),
    {
      $addFields: {
        isoYear: { $isoWeekYear: { date: { $ifNull: ["$paidAt", "$placedAt"] }, timezone } },
        isoWeek: { $isoWeek: { date: { $ifNull: ["$paidAt", "$placedAt"] }, timezone } },
      },
    },
    {
      $group: {
        _id: { year: "$isoYear", week: "$isoWeek" },
        revenue: { $sum: "$selectionRevenue" },
        orders: { $sum: 1 },
        units: { $sum: "$selectionUnits" },
        commission: { $sum: "$selectionCommission" },
      },
    },
    {
      $project: {
        _id: 0,
        bucket: { $concat: [{ $toString: "$_id.year" }, "-W", { $toString: "$_id.week" }] },
        revenue: 1,
        orders: 1,
        units: 1,
        commission: 1,
      },
    },
    { $sort: { bucket: 1 } },
  ]);

  const alerts = buildAlertSummary(dailySeries);

  // Category sales breakdown (paid only).
  const categoryBreakdown = await OrderModel.aggregate([
    { $match: { ...baseMatch, paymentStatus: PAYMENT_STATUS.PAID } },
    { $unwind: "$items" },
    ...(Object.keys(itemMatch).length ? [{ $match: itemMatch }] : []),
    {
      $group: {
        _id: "$items.product",
        revenue: { $sum: "$items.totalPrice" },
        units: { $sum: "$items.quantity" },
        commission: { $sum: "$items.commissionEarned" },
        orderIds: { $addToSet: "$_id" },
      },
    },
    {
      $project: {
        _id: 0,
        productId: "$_id",
        revenue: 1,
        units: 1,
        commission: 1,
        orders: { $size: "$orderIds" },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ["$product.category", "Uncategorized"] },
        revenue: { $sum: "$revenue" },
        units: { $sum: "$units" },
        commission: { $sum: "$commission" },
        orders: { $sum: "$orders" },
        products: { $addToSet: "$productId" },
      },
    },
    {
      $project: {
        _id: 0,
        category: "$_id",
        revenue: 1,
        units: 1,
        commission: 1,
        orders: 1,
        products: { $size: "$products" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 25 },
  ]);

  // Top selling products (paid only).
  const topProducts = await OrderModel.aggregate([
    { $match: { ...baseMatch, paymentStatus: PAYMENT_STATUS.PAID } },
    { $unwind: "$items" },
    ...(Object.keys(itemMatch).length ? [{ $match: itemMatch }] : []),
    {
      $group: {
        _id: { product: "$items.product", promoter: "$items.promoterId" },
        revenue: { $sum: "$items.totalPrice" },
        units: { $sum: "$items.quantity" },
        commission: { $sum: "$items.commissionEarned" },
        orders: { $addToSet: "$_id" },
      },
    },
    {
      $project: {
        _id: 0,
        productId: "$_id.product",
        promoterId: "$_id.promoter",
        revenue: 1,
        units: 1,
        commission: 1,
        orderCount: { $size: "$orders" },
      },
    },
    { $sort: { revenue: -1 } },
    {
      $group: {
        _id: "$productId",
        revenue: { $sum: "$revenue" },
        units: { $sum: "$units" },
        commission: { $sum: "$commission" },
        promoterBreakdown: { $push: { promoterId: "$promoterId", revenue: "$revenue", units: "$units", commission: "$commission", orderCount: "$orderCount" } },
      },
    },
    { $addFields: { topPromoters: { $slice: ["$promoterBreakdown", 3] } } },
    { $project: { promoterBreakdown: 0 } },
    { $sort: { revenue: -1 } },
    { $limit: Math.max(1, Math.min(50, Number(topLimit) || 10)) },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "stores",
        localField: "product.store",
        foreignField: "_id",
        as: "store",
      },
    },
    { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "topPromoters.promoterId",
        foreignField: "_id",
        as: "promoterDocs",
      },
    },
    {
      $addFields: {
        topPromoters: {
          $map: {
            input: "$topPromoters",
            as: "tp",
            in: {
              promoterId: "$$tp.promoterId",
              revenue: "$$tp.revenue",
              units: "$$tp.units",
              commission: "$$tp.commission",
              orderCount: "$$tp.orderCount",
              promoter: {
                $let: {
                  vars: {
                    doc: {
                      $first: {
                        $filter: {
                          input: "$promoterDocs",
                          as: "u",
                          cond: { $eq: ["$$u._id", "$$tp.promoterId"] },
                        },
                      },
                    },
                  },
                  in: {
                    _id: "$$doc._id",
                    displayName: "$$doc.displayName",
                    email: "$$doc.email",
                    username: "$$doc.username",
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      $project: {
        product: { _id: "$product._id", name: "$product.name", category: "$product.category", price: "$product.price", images: "$product.images" },
        store: { _id: "$store._id", name: "$store.name", storeLink: "$store.storeLink", logo: "$store.logo" },
        revenue: 1,
        units: 1,
        commission: 1,
        topPromoters: 1,
      },
    },
  ]);

  // Top promoters by sales (paid only).
  const topPromoters = await OrderModel.aggregate([
    { $match: { ...baseMatch, paymentStatus: PAYMENT_STATUS.PAID } },
    { $unwind: "$items" },
    ...(Object.keys(itemMatch).length ? [{ $match: itemMatch }] : []),
    { $match: { "items.promoterId": { $ne: null } } },
    {
      $group: {
        _id: "$items.promoterId",
        revenue: { $sum: "$items.totalPrice" },
        units: { $sum: "$items.quantity" },
        commission: { $sum: "$items.commissionEarned" },
        commissionPaid: {
          $sum: { $cond: [{ $eq: ["$commissionPaid", true] }, "$items.commissionEarned", 0] },
        },
        orderIds: { $addToSet: "$_id" },
        lastPaidAt: { $max: "$paidAt" },
      },
    },
    {
      $project: {
        _id: 0,
        promoterId: "$_id",
        revenue: 1,
        units: 1,
        commission: 1,
        commissionPaid: 1,
        commissionPending: { $max: [0, { $subtract: ["$commission", "$commissionPaid"] }] },
        orders: { $size: "$orderIds" },
        lastPaidAt: 1,
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: Math.max(1, Math.min(50, Number(topLimit) || 10)) },
    {
      $lookup: {
        from: "users",
        localField: "promoterId",
        foreignField: "_id",
        as: "promoter",
      },
    },
    { $unwind: { path: "$promoter", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        promoter: { _id: "$promoter._id", displayName: "$promoter.displayName", email: "$promoter.email", phone: "$promoter.personalInfo.phone", isActive: "$promoter.isActive" },
        promoterId: 1,
        revenue: 1,
        units: 1,
        orders: 1,
        commission: 1,
        commissionPaid: 1,
        commissionPending: 1,
        lastPaidAt: 1,
      },
    },
  ]);

  // Stores performing best (paid only, item filters applied).
  const topStores = await OrderModel.aggregate([
    ...buildOrderSelectionPipeline({ baseMatch: { ...baseMatch, paymentStatus: PAYMENT_STATUS.PAID }, itemMatch }),
    {
      $group: {
        _id: "$store",
        revenue: { $sum: "$selectionRevenue" },
        orders: { $sum: 1 },
        units: { $sum: "$selectionUnits" },
        lastPaidAt: { $max: "$paidAt" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "stores",
        localField: "_id",
        foreignField: "_id",
        as: "store",
      },
    },
    { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        store: { _id: "$store._id", name: "$store.name", storeLink: "$store.storeLink", logo: "$store.logo", owner: "$store.owner" },
        revenue: 1,
        orders: 1,
        units: 1,
        lastPaidAt: 1,
      },
    },
  ]);

  // Pending orders list (paid only).
  const pendingPipeline = [
    {
      $match: {
        ...baseMatch,
        paymentStatus: PAYMENT_STATUS.PAID,
        orderStatus: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED] },
      },
    },
  ];

  if (Object.keys(itemMatch).length) {
    pendingPipeline.push(
      { $unwind: "$items" },
      { $match: itemMatch },
      {
        $group: {
          _id: "$_id",
          store: { $first: "$store" },
          customer: { $first: "$customer" },
          customerType: { $first: "$customerType" },
          guestCustomer: { $first: "$guestCustomer" },
          shippingAddress: { $first: "$shippingAddress" },
          orderNumber: { $first: "$orderNumber" },
          orderStatus: { $first: "$orderStatus" },
          paymentStatus: { $first: "$paymentStatus" },
          escrowStatus: { $first: "$escrowStatus" },
          placedAt: { $first: "$placedAt" },
          paidAt: { $first: "$paidAt" },
          totalAmount: { $first: "$totalAmount" },
          currency: { $first: "$currency" },
          selectionRevenue: { $sum: "$items.totalPrice" },
          promoters: { $addToSet: "$items.promoterId" },
        },
      },
    );
  } else {
    pendingPipeline.push({
      $addFields: {
        selectionRevenue: { $sum: "$items.totalPrice" },
        promoters: { $setUnion: ["$items.promoterId", []] },
      },
    });
  }

  pendingPipeline.push(
    { $sort: { placedAt: -1 } },
    { $limit: 25 },
    { $lookup: { from: "stores", localField: "store", foreignField: "_id", as: "storeDoc" } },
    { $unwind: { path: "$storeDoc", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "users", localField: "customer", foreignField: "_id", as: "customerDoc" } },
    { $unwind: { path: "$customerDoc", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "users", localField: "promoters", foreignField: "_id", as: "promoterDocs" } },
    {
      $project: {
        _id: 1,
        orderNumber: 1,
        placedAt: 1,
        paidAt: 1,
        orderStatus: 1,
        paymentStatus: 1,
        escrowStatus: 1,
        totalAmount: 1,
        currency: 1,
        selectionRevenue: 1,
        store: { _id: "$storeDoc._id", name: "$storeDoc.name", storeLink: "$storeDoc.storeLink", logo: "$storeDoc.logo" },
        buyer: {
          customerId: "$customer",
          type: "$customerType",
          name: { $ifNull: ["$shippingAddress.fullName", "$customerDoc.displayName"] },
          email: { $ifNull: ["$shippingAddress.email", "$customerDoc.email"] },
          phone: { $ifNull: ["$shippingAddress.phone", "$customerDoc.personalInfo.phone"] },
          country: { $ifNull: ["$shippingAddress.country", ""] },
          state: { $ifNull: ["$shippingAddress.state", ""] },
        },
        promoters: {
          $map: {
            input: "$promoterDocs",
            as: "p",
            in: { _id: "$$p._id", displayName: "$$p.displayName", email: "$$p.email" },
          },
        },
      },
    },
  );

  const pendingOrders = await OrderModel.aggregate(pendingPipeline);

  // Buyer demographics (paid only, item filters applied).
  const buyerGeo = await OrderModel.aggregate([
    ...buildOrderSelectionPipeline({ baseMatch: { ...baseMatch, paymentStatus: PAYMENT_STATUS.PAID }, itemMatch }),
    {
      $group: {
        _id: { country: "$buyerCountry", state: "$buyerState" },
        orders: { $sum: 1 },
        revenue: { $sum: "$selectionRevenue" },
        buyers: { $addToSet: "$buyerKey" },
      },
    },
    {
      $project: {
        _id: 0,
        country: "$_id.country",
        state: "$_id.state",
        orders: 1,
        revenue: 1,
        buyers: { $size: "$buyers" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 15 },
  ]);

  // Referral sources (paid only, item filters applied).
  const referralSources = await OrderModel.aggregate([
    ...buildOrderSelectionPipeline({ baseMatch: { ...baseMatch, paymentStatus: PAYMENT_STATUS.PAID }, itemMatch }),
    {
      $group: {
        _id: "$referralSource",
        orders: { $sum: 1 },
        revenue: { $sum: "$selectionRevenue" },
      },
    },
    { $project: { _id: 0, source: { $ifNull: ["$_id", "unknown"] }, orders: 1, revenue: 1 } },
    { $sort: { orders: -1 } },
    { $limit: 15 },
  ]);

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    filters: {
      storeId: storeObjectId ? storeObjectId.toString() : null,
      category: category ? String(category) : null,
      productId: productObjectId ? productObjectId.toString() : null,
      promoterId: promoterObjectId ? promoterObjectId.toString() : null,
    },
    summary: {
      grossSales: summary.grossSales || 0,
      unitsSold: summary.unitsSold || 0,
      totalOrders: summary.totalOrders || 0,
      paidOrders: summary.paidOrders || 0,
      pendingOrders: summary.pendingOrders || 0,
      fulfilledOrders: summary.fulfilledOrders || 0,
      refundedOrders: summary.refundedOrders || 0,
      uniqueBuyers: summary.uniqueBuyers || 0,
      uniquePromoters,
      averageOrderValue,
      commissionAccrued: summary.commissionAccrued || 0,
      commissionPaid: summary.commissionPaid || 0,
      commissionPending: summary.commissionPending || 0,
      lastPaidAt: summary.lastPaidAt || null,
    },
    alerts,
    timeSeries: {
      daily: dailySeries || [],
      weekly: weeklySeries || [],
    },
    topProducts: topProducts || [],
    topPromoters: topPromoters || [],
    topStores: topStores || [],
    pendingOrders: pendingOrders || [],
    buyerGeo: buyerGeo || [],
    referralSources: referralSources || [],
    categoryBreakdown: categoryBreakdown || [],
  };
};

export const searchStorefrontAnalyticsProducts = async ({
  search = "",
  storeId,
  category,
  limit = 20,
} = {}) => {
  const q = String(search || "").trim();
  const storeObjectId = toObjectId(storeId);
  const categoryValue = String(category || "").trim();

  const query = {};
  if (storeObjectId) query.store = storeObjectId;
  if (categoryValue) query.category = categoryValue;
  if (q) query.name = { $regex: q, $options: "i" };

  const products = await ProductModel.find(query)
    .select("_id name category store price images")
    .limit(Math.max(1, Math.min(50, toInt(limit, 20))))
    .populate("store", "name storeLink logo")
    .lean();

  return products.map((product) => ({
    _id: product._id,
    name: product.name,
    category: product.category,
    price: product.price,
    store: product.store
      ? { _id: product.store._id, name: product.store.name, storeLink: product.store.storeLink, logo: product.store.logo }
      : null,
  }));
};

export const getStorefrontProductCategories = async () => {
  const categories = await ProductModel.distinct("category", {});
  return (categories || [])
    .map((c) => String(c || "").trim())
    .filter((c) => c.length > 0)
    .sort((a, b) => a.localeCompare(b));
};

export const getStorefrontProductPromoterBreakdown = async ({
  start,
  end,
  storeId,
  productId,
  buyerCountry,
  buyerState,
  limit = 100,
} = {}) => {
  const storeObjectId = toObjectId(storeId);
  const productObjectId = toObjectId(productId);
  if (!productObjectId) {
    throw { status: 400, message: "productId is required" };
  }

  const baseMatch = buildBaseOrderMatch({
    start,
    end,
    storeId: storeObjectId,
    buyerCountry: buyerCountry ? String(buyerCountry).trim() : null,
    buyerState: buyerState ? String(buyerState).trim() : null,
  });

  const itemMatch = buildItemMatch({ productIds: [productObjectId] });

  const breakdown = await OrderModel.aggregate([
    { $match: { ...baseMatch, paymentStatus: PAYMENT_STATUS.PAID } },
    { $unwind: "$items" },
    ...(Object.keys(itemMatch).length ? [{ $match: itemMatch }] : []),
    { $match: { "items.promoterId": { $ne: null } } },
    {
      $group: {
        _id: "$items.promoterId",
        revenue: { $sum: "$items.totalPrice" },
        units: { $sum: "$items.quantity" },
        commission: { $sum: "$items.commissionEarned" },
        orderIds: { $addToSet: "$_id" },
        lastPaidAt: { $max: "$paidAt" },
      },
    },
    {
      $project: {
        _id: 0,
        promoterId: "$_id",
        revenue: 1,
        units: 1,
        commission: 1,
        orderCount: { $size: "$orderIds" },
        lastPaidAt: 1,
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: Math.max(1, Math.min(250, toInt(limit, 100))) },
    {
      $lookup: {
        from: "users",
        localField: "promoterId",
        foreignField: "_id",
        as: "promoter",
      },
    },
    { $unwind: { path: "$promoter", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        promoterId: 1,
        revenue: 1,
        units: 1,
        commission: 1,
        orderCount: 1,
        lastPaidAt: 1,
        promoter: {
          _id: "$promoter._id",
          displayName: "$promoter.displayName",
          email: "$promoter.email",
          username: "$promoter.username",
          isActive: "$promoter.isActive",
        },
      },
    },
  ]);

  const product = await ProductModel.findById(productObjectId)
    .select("_id name category store price images")
    .populate("store", "name storeLink logo")
    .lean();

  return {
    product: product
      ? {
          _id: product._id,
          name: product.name,
          category: product.category,
          price: product.price,
          images: product.images,
          store: product.store
            ? { _id: product.store._id, name: product.store.name, storeLink: product.store.storeLink, logo: product.store.logo }
            : null,
        }
      : { _id: productObjectId, name: "", category: "", price: 0, images: [], store: null },
    breakdown: breakdown || [],
  };
};

export const getStorefrontPromoterProductBreakdown = async ({
  start,
  end,
  storeId,
  promoterId,
  buyerCountry,
  buyerState,
  limit = 100,
} = {}) => {
  const storeObjectId = toObjectId(storeId);
  const promoterObjectId = toObjectId(promoterId);
  if (!promoterObjectId) {
    throw { status: 400, message: "promoterId is required" };
  }

  const baseMatch = buildBaseOrderMatch({
    start,
    end,
    storeId: storeObjectId,
    buyerCountry: buyerCountry ? String(buyerCountry).trim() : null,
    buyerState: buyerState ? String(buyerState).trim() : null,
  });

  const itemMatch = buildItemMatch({ promoterId: promoterObjectId });

  const breakdown = await OrderModel.aggregate([
    { $match: { ...baseMatch, paymentStatus: PAYMENT_STATUS.PAID } },
    { $unwind: "$items" },
    ...(Object.keys(itemMatch).length ? [{ $match: itemMatch }] : []),
    { $match: { "items.product": { $ne: null } } },
    {
      $group: {
        _id: "$items.product",
        revenue: { $sum: "$items.totalPrice" },
        units: { $sum: "$items.quantity" },
        commission: { $sum: "$items.commissionEarned" },
        orderIds: { $addToSet: "$_id" },
        lastPaidAt: { $max: "$paidAt" },
      },
    },
    {
      $project: {
        _id: 0,
        productId: "$_id",
        revenue: 1,
        units: 1,
        commission: 1,
        orderCount: { $size: "$orderIds" },
        lastPaidAt: 1,
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: Math.max(1, Math.min(250, toInt(limit, 100))) },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "stores",
        localField: "product.store",
        foreignField: "_id",
        as: "store",
      },
    },
    { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        productId: 1,
        revenue: 1,
        units: 1,
        commission: 1,
        orderCount: 1,
        lastPaidAt: 1,
        product: { _id: "$product._id", name: "$product.name", category: "$product.category", price: "$product.price", images: "$product.images" },
        store: { _id: "$store._id", name: "$store.name", storeLink: "$store.storeLink", logo: "$store.logo" },
      },
    },
  ]);

  return {
    promoterId: promoterObjectId.toString(),
    breakdown: breakdown || [],
  };
};
