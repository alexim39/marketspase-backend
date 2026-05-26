import mongoose from "mongoose";
import { StoreModel } from "../../models/store/index.js";
import { UserModel } from "../../../user/models/user/index.js";
import { ProductModel, PromotionTrackingModel } from "../../models/promotion/index.js";
import { AffiliateClickModel } from "../../models/affiliate-click/index.js";
import { AffiliateViewModel } from "../../models/affiliate-view/index.js";
import { OrderModel, ORDER_STATUS, PAYMENT_STATUS } from "../../models/order/index.js";
import { resolveAnalyticsRange } from "../admin/storefront-analytics.service.js";

const DEFAULT_TIMEZONE = "Africa/Lagos";
const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 180;
const MAX_PRODUCT_IDS = 20000;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeTimezone = (value) => {
  const tz = String(value || "").trim();
  if (!tz) return DEFAULT_TIMEZONE;
  if (!/^[A-Za-z0-9_+./-]+$/.test(tz)) return DEFAULT_TIMEZONE;
  return tz;
};

const toObjectId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

const toInt = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
};

const clampLimit = (value, fallback = 20, max = 100) => {
  const n = toInt(value, fallback);
  return Math.min(max, Math.max(1, n));
};

const clampDays = (value, fallback = DEFAULT_RANGE_DAYS) => {
  const n = toInt(value, fallback);
  return Math.min(MAX_RANGE_DAYS, Math.max(1, n));
};

const normalizeIdStrings = (values) =>
  Array.from(new Set((values || []).map((v) => (v ? String(v) : "")).filter(Boolean)));

const filterNonEmptyStringsExpr = (arrayExpr) => ({
  $size: {
    $filter: {
      input: arrayExpr,
      as: "v",
      cond: { $and: [{ $ne: ["$$v", ""] }, { $ne: ["$$v", null] }] },
    },
  },
});

async function resolveOwnedStoreIds({ userId, uid } = {}) {
  const ors = [];

  const userObjectId = toObjectId(userId);
  if (userObjectId) ors.push({ owner: userObjectId });

  // Migration edge case: multiple Mongo user records might share same uid.
  if (uid) {
    const users = await UserModel.find({ uid: String(uid) }).select("_id").lean();
    const ids = (users || []).map((u) => u?._id).filter(Boolean);
    if (ids.length) ors.push({ owner: { $in: ids } });
  }

  if (!ors.length) return [];

  const stores = await StoreModel.find({
    isDeleted: { $ne: true },
    $or: ors,
  })
    .select("_id")
    .lean();

  return (stores || []).map((s) => s?._id).filter(Boolean);
}

async function resolveProductIdsFilter({ storeIds, storeId, category, search, productId } = {}) {
  const productObjectId = toObjectId(productId);
  if (productObjectId) return [productObjectId];

  const hasCategory = Boolean(String(category || "").trim());
  const hasSearch = Boolean(String(search || "").trim());
  if (!hasCategory && !hasSearch) return null;

  const query = { isDeleted: { $ne: true } };
  const storeObjectId = toObjectId(storeId);
  if (storeObjectId) {
    query.store = storeObjectId;
  } else if (Array.isArray(storeIds) && storeIds.length) {
    query.store = { $in: storeIds };
  }

  if (hasCategory) query.category = String(category).trim();
  if (hasSearch) query.name = new RegExp(escapeRegex(String(search).trim()), "i");

  const ids = await ProductModel.find(query).select("_id").limit(MAX_PRODUCT_IDS + 1).lean();
  if (ids.length > MAX_PRODUCT_IDS) {
    throw { status: 400, message: "Search/category filter too broad. Narrow by store or refine search." };
  }
  return ids.map((d) => d._id);
}

function buildClickMatch({ storeIds, start, end, storeId, productIds, promoterId } = {}) {
  const match = {
    store: storeIds.length === 1 ? storeIds[0] : { $in: storeIds },
    clickedAt: { $gte: start, $lte: end },
    status: "recorded",
  };
  const storeObjectId = toObjectId(storeId);
  if (storeObjectId) match.store = storeObjectId;
  if (Array.isArray(productIds) && productIds.length) match.product = productIds.length === 1 ? productIds[0] : { $in: productIds };
  const promoterObjectId = toObjectId(promoterId);
  if (promoterObjectId) match.promoter = promoterObjectId;
  return match;
}

function buildViewMatch({ storeIds, start, end, storeId, productIds, promoterId } = {}) {
  const match = {
    store: storeIds.length === 1 ? storeIds[0] : { $in: storeIds },
    viewedAt: { $gte: start, $lte: end },
    status: "recorded",
  };
  const storeObjectId = toObjectId(storeId);
  if (storeObjectId) match.store = storeObjectId;
  if (Array.isArray(productIds) && productIds.length) match.product = productIds.length === 1 ? productIds[0] : { $in: productIds };
  const promoterObjectId = toObjectId(promoterId);
  if (promoterObjectId) match.promoter = promoterObjectId;
  return match;
}

function buildOrderBaseMatch({ storeIds, start, end, storeId } = {}) {
  const match = {
    isDeleted: { $ne: true },
    store: storeIds.length === 1 ? storeIds[0] : { $in: storeIds },
    placedAt: { $gte: start, $lte: end },
  };
  const storeObjectId = toObjectId(storeId);
  if (storeObjectId) match.store = storeObjectId;
  return match;
}

function buildOrderItemMatch({ productIds, promoterId } = {}) {
  const match = {};
  if (Array.isArray(productIds) && productIds.length) {
    match["items.product"] = productIds.length === 1 ? productIds[0] : { $in: productIds };
  }
  const promoterObjectId = toObjectId(promoterId);
  if (promoterObjectId) match["items.promoterId"] = promoterObjectId;
  return match;
}

const buildAlertSummary = ({ clickDaily = [], orderDaily = [] } = {}) => {
  const alerts = [];
  const clicks = Array.isArray(clickDaily) ? clickDaily : [];
  const orders = Array.isArray(orderDaily) ? orderDaily : [];

  const lastClick = clicks[clicks.length - 1];
  if (clicks.length >= 3 && lastClick) {
    const prior = clicks.slice(Math.max(0, clicks.length - 8), clicks.length - 1);
    const avg = prior.reduce((sum, p) => sum + Number(p.clicks || 0), 0) / Math.max(1, prior.length);
    if (avg > 0) {
      const change = (Number(lastClick.clicks || 0) - avg) / avg;
      if (change >= 0.7) alerts.push(`Click spike: +${Math.round(change * 100)}% vs prior 7-day avg`);
      if (change <= -0.7) alerts.push(`Click drop: ${Math.round(change * 100)}% vs prior 7-day avg`);
    }
  }

  const lastOrder = orders[orders.length - 1];
  if (orders.length >= 3 && lastOrder) {
    const prior = orders.slice(Math.max(0, orders.length - 8), orders.length - 1);
    const avg = prior.reduce((sum, p) => sum + Number(p.orders || 0), 0) / Math.max(1, prior.length);
    if (avg > 0) {
      const change = (Number(lastOrder.orders || 0) - avg) / avg;
      if (change >= 0.7) alerts.push(`Order spike: +${Math.round(change * 100)}% vs prior 7-day avg`);
      if (change <= -0.7) alerts.push(`Order drop: ${Math.round(change * 100)}% vs prior 7-day avg`);
    }
  }

  return alerts;
};

export async function getMarketerPromotedProductsOverview({
  actorUserId,
  actorUid,
  role,
  startDate,
  endDate,
  rangeDays,
  storeId,
  category,
  productId,
  promoterId,
  search,
  page = 1,
  limit = 20,
  topLimit = 10,
  timezone,
} = {}) {
  if (role !== "marketer" && role !== "admin") {
    throw { status: 403, message: "Only marketers can view promoted product analytics." };
  }

  const storeIds = await resolveOwnedStoreIds({ userId: actorUserId, uid: actorUid });
  if (!storeIds.length) {
    return {
      summary: {
        promotedProducts: 0,
        activePromoters: 0,
        views: 0,
        uniqueViews: 0,
        clicks: 0,
        uniqueClicks: 0,
        paidOrders: 0,
        grossRevenue: 0,
        commissionAccrued: 0,
        commissionPaid: 0,
        conversionRate: 0,
        clickToOrderRate: 0,
      },
      alerts: [],
      timeSeries: { daily: [], weekly: [] },
      topProducts: [],
      topPromoters: [],
      productsPage: { page: 1, limit, total: 0, rows: [] },
    };
  }

  const tz = safeTimezone(timezone);
  const days = clampDays(rangeDays, DEFAULT_RANGE_DAYS);
  const { start, end } = resolveAnalyticsRange({
    startDate,
    endDate,
    rangeDays: days,
    now: new Date(),
  });

  const productIdsFilter = await resolveProductIdsFilter({
    storeIds,
    storeId,
    category,
    search,
    productId,
  });

  const storeObjectId = toObjectId(storeId);
  if (storeObjectId) {
    const allowed = storeIds.some((id) => String(id) === String(storeObjectId));
    if (!allowed) throw { status: 403, message: "You do not have access to this store analytics." };
  }

  const promoterObjectId = toObjectId(promoterId);

  const basePromotionMatch = {
    store: storeObjectId ? storeObjectId : (storeIds.length === 1 ? storeIds[0] : { $in: storeIds }),
    isApproved: true,
    isDeleted: { $ne: true },
  };
  if (promoterObjectId) basePromotionMatch.promoter = promoterObjectId;
  if (Array.isArray(productIdsFilter) && productIdsFilter.length) {
    basePromotionMatch.product = productIdsFilter.length === 1 ? productIdsFilter[0] : { $in: productIdsFilter };
  }

  const pageNum = Math.max(1, toInt(page, 1));
  const pageSize = clampLimit(limit, 20, 100);
  const skip = (pageNum - 1) * pageSize;

  // Base product set: products that have at least one approved promotion link.
  const [productCountAgg, productPageAgg] = await Promise.all([
    PromotionTrackingModel.aggregate([
      { $match: basePromotionMatch },
      { $group: { _id: "$product" } },
      { $count: "total" },
    ]),
    PromotionTrackingModel.aggregate([
      { $match: basePromotionMatch },
      {
        $group: {
          _id: "$product",
          store: { $first: "$store" },
          promoters: { $addToSet: "$promoter" },
          totalLinks: { $sum: 1 },
          activeLinks: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
          allTimeViews: { $sum: { $ifNull: ["$viewCount", 0] } },
          allTimeClicks: { $sum: { $ifNull: ["$clickCount", 0] } },
          allTimeConversions: { $sum: { $ifNull: ["$conversionCount", 0] } },
          allTimeEarnings: { $sum: { $ifNull: ["$earnings", 0] } },
          lastActivityAt: { $max: { $ifNull: ["$lastActivityAt", "$createdAt"] } },
          createdAt: { $min: "$createdAt" },
        },
      },
      { $sort: { lastActivityAt: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ]),
  ]);

  const totalProducts = Number(productCountAgg?.[0]?.total || 0);
  const pageProductIds = productPageAgg.map((row) => row._id).filter(Boolean);
  const pageStoreIds = normalizeIdStrings(productPageAgg.map((row) => row.store));

  // Fetch product + store detail for current page.
  const [products, stores, promoters] = await Promise.all([
    pageProductIds.length
      ? ProductModel.find({ _id: { $in: pageProductIds } })
        .select("_id name category price currency images slug isActive isPublished store")
        .lean()
      : [],
    pageStoreIds.length
      ? StoreModel.find({ _id: { $in: pageStoreIds.map((id) => new mongoose.Types.ObjectId(id)) } })
        .select("_id name storeLink logo category isActive isVerified verificationTier owner")
        .lean()
      : [],
    (() => {
      const promoterIds = productPageAgg.flatMap((row) => (row.promoters || []).map((p) => String(p))).filter(Boolean);
      const uniq = Array.from(new Set(promoterIds));
      if (!uniq.length) return Promise.resolve([]);
      return UserModel.find({ _id: { $in: uniq.map((id) => new mongoose.Types.ObjectId(id)) } })
        .select("_id displayName username email avatar role")
        .lean();
    })(),
  ]);

  const productById = new Map(products.map((p) => [String(p._id), p]));
  const storeById = new Map(stores.map((s) => [String(s._id), s]));
  const promoterById = new Map(promoters.map((u) => [String(u._id), u]));

  // --- Summary + time-series ---
  const clickMatch = buildClickMatch({ storeIds, start, end, storeId, productIds: productIdsFilter, promoterId });
  const viewMatch = buildViewMatch({ storeIds, start, end, storeId, productIds: productIdsFilter, promoterId });
  const orderBaseMatch = buildOrderBaseMatch({ storeIds, start, end, storeId });
  const orderItemMatch = buildOrderItemMatch({ productIds: productIdsFilter, promoterId });

  const [
    clickSummaryAgg,
    viewSummaryAgg,
    orderSummaryAgg,
    clickDaily,
    clickWeekly,
    orderDaily,
    orderWeekly,
  ] = await Promise.all([
    AffiliateClickModel.aggregate([
      { $match: clickMatch },
      {
        $group: {
          _id: null,
          clicks: { $sum: 1 },
          uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } },
          promoterIds: { $addToSet: "$promoter" },
          lastClickAt: { $max: "$clickedAt" },
        },
      },
      {
        $project: {
          _id: 0,
          clicks: 1,
          uniqueClicks: filterNonEmptyStringsExpr("$uniqueIps"),
          promoterIds: 1,
          lastClickAt: 1,
        },
      },
    ]),
    AffiliateViewModel.aggregate([
      { $match: viewMatch },
      {
        $group: {
          _id: null,
          views: { $sum: 1 },
          uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } },
          promoterIds: { $addToSet: "$promoter" },
          lastViewAt: { $max: "$viewedAt" },
        },
      },
      {
        $project: {
          _id: 0,
          views: 1,
          uniqueViews: filterNonEmptyStringsExpr("$uniqueIps"),
          promoterIds: 1,
          lastViewAt: 1,
        },
      },
    ]),
    OrderModel.aggregate([
      { $match: orderBaseMatch },
      { $unwind: "$items" },
      ...(Object.keys(orderItemMatch).length ? [{ $match: orderItemMatch }] : []),
      {
        $group: {
          _id: "$_id",
          paymentStatus: { $first: "$paymentStatus" },
          orderStatus: { $first: "$orderStatus" },
          escrowStatus: { $first: "$escrowStatus" },
          commissionPaid: { $first: "$commissionPaid" },
          paidAt: { $first: "$paidAt" },
          placedAt: { $first: "$placedAt" },
          revenue: { $sum: "$items.totalPrice" },
          units: { $sum: "$items.quantity" },
          commission: { $sum: "$items.commissionEarned" },
          promoterIds: { $addToSet: "$items.promoterId" },
          buyerKey: {
            $first: {
              $ifNull: [
                { $toString: "$customer" },
                { $ifNull: ["$guestCustomer.email", { $ifNull: ["$shippingAddress.email", "$shippingAddress.phone"] }] },
              ],
            },
          },
          buyerCountry: { $first: { $ifNull: ["$shippingAddress.country", ""] } },
          buyerState: { $first: { $ifNull: ["$shippingAddress.state", ""] } },
          referralSource: { $first: { $ifNull: ["$guestCustomer.source", "$customerType"] } },
        },
      },
      {
        $addFields: {
          isPaid: { $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] },
          isPending: {
            $and: [
              { $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] },
              { $in: ["$orderStatus", [ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED]] },
            ],
          },
          isFulfilled: {
            $and: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, { $eq: ["$orderStatus", ORDER_STATUS.DELIVERED] }],
          },
          isRefunded: {
            $or: [
              { $eq: ["$orderStatus", ORDER_STATUS.REFUNDED] },
              { $in: ["$paymentStatus", [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED]] },
            ],
          },
          paidRevenue: { $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$revenue", 0] },
          paidUnits: { $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$units", 0] },
          paidCommission: { $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$commission", 0] },
          paidCommissionPaid: {
            $cond: [
              { $and: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, { $eq: ["$commissionPaid", true] }] },
              "$commission",
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          grossRevenue: { $sum: "$paidRevenue" },
          unitsSold: { $sum: "$paidUnits" },
          commissionAccrued: { $sum: "$paidCommission" },
          commissionPaid: { $sum: "$paidCommissionPaid" },
          totalOrders: { $sum: 1 },
          paidOrders: { $sum: { $cond: ["$isPaid", 1, 0] } },
          pendingOrders: { $sum: { $cond: ["$isPending", 1, 0] } },
          fulfilledOrders: { $sum: { $cond: ["$isFulfilled", 1, 0] } },
          refundedOrders: { $sum: { $cond: ["$isRefunded", 1, 0] } },
          uniqueBuyers: { $addToSet: "$buyerKey" },
          promoterIds: { $addToSet: "$promoterIds" },
          lastPaidAt: { $max: { $ifNull: ["$paidAt", "$placedAt"] } },
        },
      },
      {
        $project: {
          _id: 0,
          grossRevenue: 1,
          unitsSold: 1,
          commissionAccrued: 1,
          commissionPaid: 1,
          totalOrders: 1,
          paidOrders: 1,
          pendingOrders: 1,
          fulfilledOrders: 1,
          refundedOrders: 1,
          uniqueBuyerCount: filterNonEmptyStringsExpr("$uniqueBuyers"),
          promoterIds: 1,
          lastPaidAt: 1,
        },
      },
    ]),
    AffiliateClickModel.aggregate([
      { $match: clickMatch },
      {
        $addFields: {
          bucket: {
            $dateToString: { format: "%Y-%m-%d", date: "$clickedAt", timezone: tz },
          },
        },
      },
      {
        $group: {
          _id: "$bucket",
          clicks: { $sum: 1 },
          uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } },
        },
      },
      {
        $project: {
          _id: 0,
          bucket: "$_id",
          clicks: 1,
          uniqueClicks: filterNonEmptyStringsExpr("$uniqueIps"),
        },
      },
      { $sort: { bucket: 1 } },
    ]),
    AffiliateClickModel.aggregate([
      { $match: clickMatch },
      {
        $addFields: {
          isoYear: { $isoWeekYear: { date: "$clickedAt", timezone: tz } },
          isoWeek: { $isoWeek: { date: "$clickedAt", timezone: tz } },
        },
      },
      {
        $group: {
          _id: { year: "$isoYear", week: "$isoWeek" },
          clicks: { $sum: 1 },
          uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } },
        },
      },
      {
        $project: {
          _id: 0,
          bucket: { $concat: [{ $toString: "$_id.year" }, "-W", { $toString: "$_id.week" }] },
          clicks: 1,
          uniqueClicks: filterNonEmptyStringsExpr("$uniqueIps"),
        },
      },
      { $sort: { bucket: 1 } },
    ]),
    OrderModel.aggregate([
      { $match: { ...orderBaseMatch, paymentStatus: PAYMENT_STATUS.PAID } },
      { $unwind: "$items" },
      ...(Object.keys(orderItemMatch).length ? [{ $match: orderItemMatch }] : []),
      {
        $group: {
          _id: "$_id",
          bucket: {
            $first: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: { $ifNull: ["$paidAt", "$placedAt"] },
                timezone: tz,
              },
            },
          },
          revenue: { $sum: "$items.totalPrice" },
          units: { $sum: "$items.quantity" },
          commission: { $sum: "$items.commissionEarned" },
        },
      },
      {
        $group: {
          _id: "$bucket",
          revenue: { $sum: "$revenue" },
          orders: { $sum: 1 },
          units: { $sum: "$units" },
          commission: { $sum: "$commission" },
        },
      },
      { $project: { _id: 0, bucket: "$_id", revenue: 1, orders: 1, units: 1, commission: 1 } },
      { $sort: { bucket: 1 } },
    ]),
    OrderModel.aggregate([
      { $match: { ...orderBaseMatch, paymentStatus: PAYMENT_STATUS.PAID } },
      { $unwind: "$items" },
      ...(Object.keys(orderItemMatch).length ? [{ $match: orderItemMatch }] : []),
      {
        $group: {
          _id: "$_id",
          isoYear: { $first: { $isoWeekYear: { date: { $ifNull: ["$paidAt", "$placedAt"] }, timezone: tz } } },
          isoWeek: { $first: { $isoWeek: { date: { $ifNull: ["$paidAt", "$placedAt"] }, timezone: tz } } },
          revenue: { $sum: "$items.totalPrice" },
          units: { $sum: "$items.quantity" },
          commission: { $sum: "$items.commissionEarned" },
        },
      },
      {
        $group: {
          _id: { year: "$isoYear", week: "$isoWeek" },
          revenue: { $sum: "$revenue" },
          orders: { $sum: 1 },
          units: { $sum: "$units" },
          commission: { $sum: "$commission" },
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
    ]),
  ]);

  const clickSummary = clickSummaryAgg?.[0] || { clicks: 0, uniqueClicks: 0, promoterIds: [], lastClickAt: null };
  const viewSummary = viewSummaryAgg?.[0] || { views: 0, uniqueViews: 0, promoterIds: [], lastViewAt: null };
  const orderSummary = orderSummaryAgg?.[0] || {
    grossRevenue: 0,
    unitsSold: 0,
    commissionAccrued: 0,
    commissionPaid: 0,
    totalOrders: 0,
    paidOrders: 0,
    pendingOrders: 0,
    fulfilledOrders: 0,
    refundedOrders: 0,
    uniqueBuyerCount: 0,
    promoterIds: [],
    lastPaidAt: null,
  };

  const activePromoterIds = normalizeIdStrings((clickSummary.promoterIds || []).flat());
  const promotedProducts = totalProducts;

  const clickToOrderRate = clickSummary.clicks > 0 ? (Number(orderSummary.paidOrders || 0) / Number(clickSummary.clicks || 0)) * 100 : 0;
  const conversionRate = viewSummary.views > 0 ? (Number(orderSummary.paidOrders || 0) / Number(viewSummary.views || 0)) * 100 : 0;

  // --- Top products (by paid revenue) + top promoters (by paid revenue) ---
  const topN = clampLimit(topLimit, 10, 50);

  const [topProductsAgg, topPromotersAgg] = await Promise.all([
    OrderModel.aggregate([
      { $match: { ...orderBaseMatch, paymentStatus: PAYMENT_STATUS.PAID } },
      { $unwind: "$items" },
      ...(Object.keys(orderItemMatch).length ? [{ $match: orderItemMatch }] : []),
      {
        $group: {
          _id: "$items.product",
          revenue: { $sum: "$items.totalPrice" },
          units: { $sum: "$items.quantity" },
          commission: { $sum: "$items.commissionEarned" },
          orderIds: { $addToSet: "$_id" },
          promoterIds: { $addToSet: "$items.promoterId" },
        },
      },
      { $project: { _id: 0, productId: "$_id", revenue: 1, units: 1, commission: 1, orders: { $size: "$orderIds" }, promoterIds: 1 } },
      { $sort: { revenue: -1 } },
      { $limit: topN },
    ]),
    OrderModel.aggregate([
      { $match: { ...orderBaseMatch, paymentStatus: PAYMENT_STATUS.PAID } },
      { $unwind: "$items" },
      ...(Object.keys(orderItemMatch).length ? [{ $match: orderItemMatch }] : []),
      {
        $group: {
          _id: "$items.promoterId",
          revenue: { $sum: "$items.totalPrice" },
          units: { $sum: "$items.quantity" },
          commission: { $sum: "$items.commissionEarned" },
          orderIds: { $addToSet: "$_id" },
          productIds: { $addToSet: "$items.product" },
          commissionPaid: { $sum: { $cond: [{ $eq: ["$commissionPaid", true] }, "$items.commissionEarned", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          promoterId: "$_id",
          revenue: 1,
          units: 1,
          commission: 1,
          orders: { $size: "$orderIds" },
          products: { $size: "$productIds" },
          commissionPaid: 1,
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: topN },
    ]),
  ]);

  const topProductIds = topProductsAgg.map((r) => r.productId).filter(Boolean);
  const topPromoterIds = topPromotersAgg.map((r) => r.promoterId).filter(Boolean);

  const [topProductDocs, topPromoterDocs, clickTopByProduct, clickTopByPromoter, viewTopByProduct, viewTopByPromoter] = await Promise.all([
    topProductIds.length ? ProductModel.find({ _id: { $in: topProductIds } }).select("_id name category price currency images slug store").lean() : [],
    topPromoterIds.length ? UserModel.find({ _id: { $in: topPromoterIds } }).select("_id displayName username email avatar role").lean() : [],
    topProductIds.length
      ? AffiliateClickModel.aggregate([
        { $match: buildClickMatch({ storeIds, start, end, storeId, productIds: topProductIds, promoterId }) },
        { $group: { _id: "$product", clicks: { $sum: 1 }, uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } } } },
        { $project: { _id: 0, productId: "$_id", clicks: 1, uniqueClicks: filterNonEmptyStringsExpr("$uniqueIps") } },
      ])
      : [],
    topPromoterIds.length
      ? AffiliateClickModel.aggregate([
        { $match: buildClickMatch({ storeIds, start, end, storeId, productIds: productIdsFilter, promoterId: null }) },
        { $match: { promoter: { $in: topPromoterIds } } },
        { $group: { _id: "$promoter", clicks: { $sum: 1 }, uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } } } },
        { $project: { _id: 0, promoterId: "$_id", clicks: 1, uniqueClicks: filterNonEmptyStringsExpr("$uniqueIps") } },
      ])
      : [],
    topProductIds.length
      ? AffiliateViewModel.aggregate([
        { $match: buildViewMatch({ storeIds, start, end, storeId, productIds: topProductIds, promoterId }) },
        { $group: { _id: "$product", views: { $sum: 1 }, uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } } } },
        { $project: { _id: 0, productId: "$_id", views: 1, uniqueViews: filterNonEmptyStringsExpr("$uniqueIps") } },
      ])
      : [],
    topPromoterIds.length
      ? AffiliateViewModel.aggregate([
        { $match: buildViewMatch({ storeIds, start, end, storeId, productIds: productIdsFilter, promoterId: null }) },
        { $match: { promoter: { $in: topPromoterIds } } },
        { $group: { _id: "$promoter", views: { $sum: 1 }, uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } } } },
        { $project: { _id: 0, promoterId: "$_id", views: 1, uniqueViews: filterNonEmptyStringsExpr("$uniqueIps") } },
      ])
      : [],
  ]);

  const topProductById = new Map(topProductDocs.map((p) => [String(p._id), p]));
  const topPromoterById = new Map(topPromoterDocs.map((u) => [String(u._id), u]));
  const clickByProductId = new Map(clickTopByProduct.map((r) => [String(r.productId), r]));
  const clickByPromoterId = new Map(clickTopByPromoter.map((r) => [String(r.promoterId), r]));
  const viewByProductId = new Map(viewTopByProduct.map((r) => [String(r.productId), r]));
  const viewByPromoterId = new Map(viewTopByPromoter.map((r) => [String(r.promoterId), r]));

  const topProducts = topProductsAgg.map((row) => {
    const p = topProductById.get(String(row.productId)) || null;
    const click = clickByProductId.get(String(row.productId)) || { clicks: 0, uniqueClicks: 0 };
    const view = viewByProductId.get(String(row.productId)) || { views: 0, uniqueViews: 0 };
    const ctr = view.views > 0 ? (Number(click.clicks || 0) / Number(view.views || 0)) * 100 : 0;
    const cvr = click.clicks > 0 ? (Number(row.orders || 0) / Number(click.clicks || 0)) * 100 : 0;
    return {
      product: p ? { _id: p._id, name: p.name, category: p.category, price: p.price, currency: p.currency, image: p.images?.[0]?.url || null, slug: p.slug, store: p.store } : null,
      revenue: row.revenue || 0,
      units: row.units || 0,
      orders: row.orders || 0,
      commission: row.commission || 0,
      views: view.views || 0,
      uniqueViews: view.uniqueViews || 0,
      clicks: click.clicks || 0,
      uniqueClicks: click.uniqueClicks || 0,
      clickThroughRate: ctr,
      conversionRate: cvr,
      promoterIds: normalizeIdStrings(row.promoterIds),
    };
  });

  const topPromoters = topPromotersAgg.map((row) => {
    const u = topPromoterById.get(String(row.promoterId)) || null;
    const click = clickByPromoterId.get(String(row.promoterId)) || { clicks: 0, uniqueClicks: 0 };
    const view = viewByPromoterId.get(String(row.promoterId)) || { views: 0, uniqueViews: 0 };
    const ctr = view.views > 0 ? (Number(click.clicks || 0) / Number(view.views || 0)) * 100 : 0;
    const cvr = click.clicks > 0 ? (Number(row.orders || 0) / Number(click.clicks || 0)) * 100 : 0;
    return {
      promoter: u ? { _id: u._id, displayName: u.displayName, username: u.username, email: u.email, avatar: u.avatar } : { _id: row.promoterId, displayName: "Promoter", email: "" },
      revenue: row.revenue || 0,
      orders: row.orders || 0,
      units: row.units || 0,
      commission: row.commission || 0,
      commissionPaid: row.commissionPaid || 0,
      products: row.products || 0,
      views: view.views || 0,
      uniqueViews: view.uniqueViews || 0,
      clicks: click.clicks || 0,
      uniqueClicks: click.uniqueClicks || 0,
      clickThroughRate: ctr,
      conversionRate: cvr,
    };
  });

  // --- Page rows: enrich with clicks/views/orders for the current page set ---
  const pageClickMatch = buildClickMatch({ storeIds, start, end, storeId, productIds: pageProductIds, promoterId });
  const pageViewMatch = buildViewMatch({ storeIds, start, end, storeId, productIds: pageProductIds, promoterId });
  const pageOrderBaseMatch = buildOrderBaseMatch({ storeIds, start, end, storeId });
  const pageOrderItemMatch = buildOrderItemMatch({ productIds: pageProductIds, promoterId });

  const [clickByProductAgg, viewByProductAgg, ordersByProductAgg, topPromotersByProductAgg] = await Promise.all([
    pageProductIds.length
      ? AffiliateClickModel.aggregate([
        { $match: pageClickMatch },
        {
          $group: {
            _id: "$product",
            clicks: { $sum: 1 },
            uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } },
            lastClickAt: { $max: "$clickedAt" },
          },
        },
        { $project: { _id: 0, productId: "$_id", clicks: 1, uniqueClicks: filterNonEmptyStringsExpr("$uniqueIps"), lastClickAt: 1 } },
      ])
      : [],
    pageProductIds.length
      ? AffiliateViewModel.aggregate([
        { $match: pageViewMatch },
        {
          $group: {
            _id: "$product",
            views: { $sum: 1 },
            uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } },
            lastViewAt: { $max: "$viewedAt" },
          },
        },
        { $project: { _id: 0, productId: "$_id", views: 1, uniqueViews: filterNonEmptyStringsExpr("$uniqueIps"), lastViewAt: 1 } },
      ])
      : [],
    pageProductIds.length
      ? OrderModel.aggregate([
        { $match: pageOrderBaseMatch },
        { $unwind: "$items" },
        ...(Object.keys(pageOrderItemMatch).length ? [{ $match: pageOrderItemMatch }] : []),
        {
          $group: {
            _id: { product: "$items.product", orderId: "$_id" },
            paymentStatus: { $first: "$paymentStatus" },
            orderStatus: { $first: "$orderStatus" },
            escrowStatus: { $first: "$escrowStatus" },
            commissionPaid: { $first: "$commissionPaid" },
            revenue: { $sum: "$items.totalPrice" },
            units: { $sum: "$items.quantity" },
            commission: { $sum: "$items.commissionEarned" },
          },
        },
        {
          $addFields: {
            isPaid: { $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] },
            isPending: {
              $and: [
                { $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] },
                { $in: ["$orderStatus", [ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED]] },
              ],
            },
            isFulfilled: {
              $and: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, { $eq: ["$orderStatus", ORDER_STATUS.DELIVERED] }],
            },
            isRefunded: {
              $or: [
                { $eq: ["$orderStatus", ORDER_STATUS.REFUNDED] },
                { $in: ["$paymentStatus", [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED]] },
              ],
            },
            paidRevenue: { $cond: ["$isPaid", "$revenue", 0] },
            paidUnits: { $cond: ["$isPaid", "$units", 0] },
            paidCommission: { $cond: ["$isPaid", "$commission", 0] },
            paidCommissionPaid: {
              $cond: [{ $and: ["$isPaid", { $eq: ["$commissionPaid", true] }] }, "$commission", 0],
            },
          },
        },
        {
          $group: {
            _id: "$_id.product",
            totalOrders: { $sum: 1 },
            paidOrders: { $sum: { $cond: ["$isPaid", 1, 0] } },
            pendingOrders: { $sum: { $cond: ["$isPending", 1, 0] } },
            fulfilledOrders: { $sum: { $cond: ["$isFulfilled", 1, 0] } },
            refundedOrders: { $sum: { $cond: ["$isRefunded", 1, 0] } },
            grossRevenue: { $sum: "$paidRevenue" },
            units: { $sum: "$paidUnits" },
            commissionAccrued: { $sum: "$paidCommission" },
            commissionPaid: { $sum: "$paidCommissionPaid" },
          },
        },
        {
          $project: {
            _id: 0,
            productId: "$_id",
            totalOrders: 1,
            paidOrders: 1,
            pendingOrders: 1,
            fulfilledOrders: 1,
            refundedOrders: 1,
            grossRevenue: 1,
            units: 1,
            commissionAccrued: 1,
            commissionPaid: 1,
          },
        },
      ])
      : [],
    pageProductIds.length
      ? OrderModel.aggregate([
        { $match: { ...pageOrderBaseMatch, paymentStatus: PAYMENT_STATUS.PAID } },
        { $unwind: "$items" },
        ...(Object.keys(pageOrderItemMatch).length ? [{ $match: pageOrderItemMatch }] : []),
        {
          $group: {
            _id: { product: "$items.product", promoter: "$items.promoterId" },
            revenue: { $sum: "$items.totalPrice" },
            commission: { $sum: "$items.commissionEarned" },
            orderIds: { $addToSet: "$_id" },
          },
        },
        {
          $project: {
            _id: 0,
            productId: "$_id.product",
            promoterId: "$_id.promoter",
            revenue: 1,
            commission: 1,
            orders: { $size: "$orderIds" },
          },
        },
        { $sort: { revenue: -1 } },
      ])
      : [],
  ]);

  const pageClicksMap = new Map(clickByProductAgg.map((r) => [String(r.productId), r]));
  const pageViewsMap = new Map(viewByProductAgg.map((r) => [String(r.productId), r]));
  const pageOrdersMap = new Map(ordersByProductAgg.map((r) => [String(r.productId), r]));

  const promoterIdsForPreview = normalizeIdStrings(topPromotersByProductAgg.map((r) => r.promoterId));
  const promoterPreviewDocs = promoterIdsForPreview.length
    ? await UserModel.find({ _id: { $in: promoterIdsForPreview.map((id) => new mongoose.Types.ObjectId(id)) } })
      .select("_id displayName username email avatar")
      .lean()
    : [];
  const promoterPreviewMap = new Map(promoterPreviewDocs.map((u) => [String(u._id), u]));

  const topPromotersByProductMap = new Map();
  for (const row of topPromotersByProductAgg) {
    const pid = String(row.productId);
    if (!topPromotersByProductMap.has(pid)) topPromotersByProductMap.set(pid, []);
    topPromotersByProductMap.get(pid).push(row);
  }

  const productsPageRows = productPageAgg.map((base) => {
    const product = productById.get(String(base._id)) || null;
    const store = storeById.get(String(base.store)) || null;
    const clicks = pageClicksMap.get(String(base._id)) || { clicks: 0, uniqueClicks: 0, lastClickAt: null };
    const views = pageViewsMap.get(String(base._id)) || { views: 0, uniqueViews: 0, lastViewAt: null };
    const orders = pageOrdersMap.get(String(base._id)) || {
      totalOrders: 0,
      paidOrders: 0,
      pendingOrders: 0,
      fulfilledOrders: 0,
      refundedOrders: 0,
      grossRevenue: 0,
      units: 0,
      commissionAccrued: 0,
      commissionPaid: 0,
    };

    const ctr = views.views > 0 ? (Number(clicks.clicks || 0) / Number(views.views || 0)) * 100 : 0;
    const cvr = clicks.clicks > 0 ? (Number(orders.paidOrders || 0) / Number(clicks.clicks || 0)) * 100 : 0;
    const promoterPreview = (topPromotersByProductMap.get(String(base._id)) || []).slice(0, 3).map((p) => ({
      promoter: promoterPreviewMap.get(String(p.promoterId)) || promoterById.get(String(p.promoterId)) || { _id: p.promoterId, displayName: "Promoter" },
      revenue: p.revenue || 0,
      orders: p.orders || 0,
      commission: p.commission || 0,
    }));

    return {
      product: product
        ? {
          _id: product._id,
          name: product.name,
          category: product.category,
          price: product.price,
          currency: product.currency,
          image: product.images?.[0]?.url || null,
          slug: product.slug,
          isActive: product.isActive !== false,
          isPublished: product.isPublished !== false,
        }
        : { _id: base._id, name: "Product", category: "", price: 0, currency: "NGN", image: null },
      store: store
        ? { _id: store._id, name: store.name, storeLink: store.storeLink, logo: store.logo, category: store.category }
        : (base.store ? { _id: base.store } : null),
      links: { total: base.totalLinks || 0, active: base.activeLinks || 0 },
      allTime: {
        views: base.allTimeViews || 0,
        clicks: base.allTimeClicks || 0,
        conversions: base.allTimeConversions || 0,
        earnings: base.allTimeEarnings || 0,
      },
      range: {
        views: views.views || 0,
        uniqueViews: views.uniqueViews || 0,
        clicks: clicks.clicks || 0,
        uniqueClicks: clicks.uniqueClicks || 0,
        clickThroughRate: ctr,
        paidOrders: orders.paidOrders || 0,
        totalOrders: orders.totalOrders || 0,
        pendingOrders: orders.pendingOrders || 0,
        fulfilledOrders: orders.fulfilledOrders || 0,
        refundedOrders: orders.refundedOrders || 0,
        grossRevenue: orders.grossRevenue || 0,
        units: orders.units || 0,
        commissionAccrued: orders.commissionAccrued || 0,
        commissionPaid: orders.commissionPaid || 0,
        conversionRate: cvr,
      },
      lastActivityAt: base.lastActivityAt || base.createdAt,
      topPromoters: promoterPreview,
    };
  });

  const alerts = buildAlertSummary({ clickDaily, orderDaily });

  return {
    summary: {
      promotedProducts,
      activePromoters: activePromoterIds.length,
      views: Number(viewSummary.views || 0),
      uniqueViews: Number(viewSummary.uniqueViews || 0),
      clicks: Number(clickSummary.clicks || 0),
      uniqueClicks: Number(clickSummary.uniqueClicks || 0),
      paidOrders: Number(orderSummary.paidOrders || 0),
      grossRevenue: Number(orderSummary.grossRevenue || 0),
      commissionAccrued: Number(orderSummary.commissionAccrued || 0),
      commissionPaid: Number(orderSummary.commissionPaid || 0),
      conversionRate,
      clickToOrderRate,
      lastPaidAt: orderSummary.lastPaidAt || null,
    },
    alerts,
    timeSeries: {
      daily: (orderDaily || []).map((o) => {
        const click = (clickDaily || []).find((c) => c.bucket === o.bucket) || null;
        return {
          bucket: o.bucket,
          revenue: o.revenue || 0,
          orders: o.orders || 0,
          clicks: click?.clicks || 0,
          uniqueClicks: click?.uniqueClicks || 0,
          commission: o.commission || 0,
        };
      }),
      weekly: (orderWeekly || []).map((o) => {
        const click = (clickWeekly || []).find((c) => c.bucket === o.bucket) || null;
        return {
          bucket: o.bucket,
          revenue: o.revenue || 0,
          orders: o.orders || 0,
          clicks: click?.clicks || 0,
          uniqueClicks: click?.uniqueClicks || 0,
          commission: o.commission || 0,
        };
      }),
    },
    topProducts,
    topPromoters,
    productsPage: {
      page: pageNum,
      limit: pageSize,
      total: totalProducts,
      rows: productsPageRows,
    },
  };
}

export async function getMarketerProductPromoterBreakdown({
  actorUserId,
  actorUid,
  role,
  productId,
  startDate,
  endDate,
  rangeDays,
  storeId,
  timezone,
  limit = 100,
} = {}) {
  if (role !== "marketer" && role !== "admin") {
    throw { status: 403, message: "Only marketers can view promoted product analytics." };
  }
  const productObjectId = toObjectId(productId);
  if (!productObjectId) throw { status: 400, message: "productId is required" };

  const storeIds = await resolveOwnedStoreIds({ userId: actorUserId, uid: actorUid });
  if (!storeIds.length) return { productId, rows: [] };

  const tz = safeTimezone(timezone);
  const days = clampDays(rangeDays, DEFAULT_RANGE_DAYS);
  const { start, end } = resolveAnalyticsRange({ startDate, endDate, rangeDays: days, now: new Date() });

  const storeObjectId = toObjectId(storeId);
  if (storeObjectId) {
    const allowed = storeIds.some((id) => String(id) === String(storeObjectId));
    if (!allowed) throw { status: 403, message: "You do not have access to this store analytics." };
  }

  const clickMatch = buildClickMatch({ storeIds, start, end, storeId, productIds: [productObjectId] });
  const viewMatch = buildViewMatch({ storeIds, start, end, storeId, productIds: [productObjectId] });
  const orderBaseMatch = buildOrderBaseMatch({ storeIds, start, end, storeId });
  const orderItemMatch = buildOrderItemMatch({ productIds: [productObjectId] });

  const lim = clampLimit(limit, 100, 250);

  const [clickAgg, viewAgg, orderAgg] = await Promise.all([
    AffiliateClickModel.aggregate([
      { $match: clickMatch },
      {
        $group: {
          _id: "$promoter",
          clicks: { $sum: 1 },
          uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } },
          lastClickAt: { $max: "$clickedAt" },
          sources: { $addToSet: "$source" },
        },
      },
      {
        $project: {
          _id: 0,
          promoterId: "$_id",
          clicks: 1,
          uniqueClicks: filterNonEmptyStringsExpr("$uniqueIps"),
          lastClickAt: 1,
        },
      },
    ]),
    AffiliateViewModel.aggregate([
      { $match: viewMatch },
      {
        $group: {
          _id: "$promoter",
          views: { $sum: 1 },
          uniqueIps: { $addToSet: { $ifNull: ["$ipHash", ""] } },
          lastViewAt: { $max: "$viewedAt" },
        },
      },
      {
        $project: {
          _id: 0,
          promoterId: "$_id",
          views: 1,
          uniqueViews: filterNonEmptyStringsExpr("$uniqueIps"),
          lastViewAt: 1,
        },
      },
    ]),
    OrderModel.aggregate([
      { $match: orderBaseMatch },
      { $unwind: "$items" },
      ...(Object.keys(orderItemMatch).length ? [{ $match: orderItemMatch }] : []),
      {
        $group: {
          _id: { promoter: "$items.promoterId", orderId: "$_id" },
          paymentStatus: { $first: "$paymentStatus" },
          orderStatus: { $first: "$orderStatus" },
          commissionPaid: { $first: "$commissionPaid" },
          revenue: { $sum: "$items.totalPrice" },
          units: { $sum: "$items.quantity" },
          commission: { $sum: "$items.commissionEarned" },
        },
      },
      {
        $addFields: {
          isPaid: { $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] },
          isPending: {
            $and: [
              { $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] },
              { $in: ["$orderStatus", [ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED]] },
            ],
          },
          isFulfilled: {
            $and: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, { $eq: ["$orderStatus", ORDER_STATUS.DELIVERED] }],
          },
          isRefunded: {
            $or: [
              { $eq: ["$orderStatus", ORDER_STATUS.REFUNDED] },
              { $in: ["$paymentStatus", [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED]] },
            ],
          },
          paidRevenue: { $cond: ["$isPaid", "$revenue", 0] },
          paidUnits: { $cond: ["$isPaid", "$units", 0] },
          paidCommission: { $cond: ["$isPaid", "$commission", 0] },
          paidCommissionPaid: {
            $cond: [{ $and: ["$isPaid", { $eq: ["$commissionPaid", true] }] }, "$commission", 0],
          },
        },
      },
      {
        $group: {
          _id: "$_id.promoter",
          totalOrders: { $sum: 1 },
          paidOrders: { $sum: { $cond: ["$isPaid", 1, 0] } },
          pendingOrders: { $sum: { $cond: ["$isPending", 1, 0] } },
          fulfilledOrders: { $sum: { $cond: ["$isFulfilled", 1, 0] } },
          refundedOrders: { $sum: { $cond: ["$isRefunded", 1, 0] } },
          revenue: { $sum: "$paidRevenue" },
          units: { $sum: "$paidUnits" },
          commission: { $sum: "$paidCommission" },
          commissionPaid: { $sum: "$paidCommissionPaid" },
        },
      },
      {
        $project: {
          _id: 0,
          promoterId: "$_id",
          totalOrders: 1,
          paidOrders: 1,
          pendingOrders: 1,
          fulfilledOrders: 1,
          refundedOrders: 1,
          revenue: 1,
          units: 1,
          commission: 1,
          commissionPaid: 1,
        },
      },
    ]),
  ]);

  const promoterIds = normalizeIdStrings([
    ...clickAgg.map((r) => r.promoterId),
    ...viewAgg.map((r) => r.promoterId),
    ...orderAgg.map((r) => r.promoterId),
  ]);

  const promoters = promoterIds.length
    ? await UserModel.find({ _id: { $in: promoterIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .select("_id displayName username email avatar")
      .lean()
    : [];
  const promoterById = new Map(promoters.map((u) => [String(u._id), u]));
  const clicksByPromoter = new Map(clickAgg.map((r) => [String(r.promoterId), r]));
  const viewsByPromoter = new Map(viewAgg.map((r) => [String(r.promoterId), r]));
  const ordersByPromoter = new Map(orderAgg.map((r) => [String(r.promoterId), r]));

  const rows = promoterIds
    .map((id) => {
      const c = clicksByPromoter.get(id) || { clicks: 0, uniqueClicks: 0, lastClickAt: null };
      const v = viewsByPromoter.get(id) || { views: 0, uniqueViews: 0, lastViewAt: null };
      const o = ordersByPromoter.get(id) || { paidOrders: 0, totalOrders: 0, revenue: 0, commission: 0, commissionPaid: 0, pendingOrders: 0, fulfilledOrders: 0, refundedOrders: 0 };
      const ctr = v.views > 0 ? (Number(c.clicks || 0) / Number(v.views || 0)) * 100 : 0;
      const cvr = c.clicks > 0 ? (Number(o.paidOrders || 0) / Number(c.clicks || 0)) * 100 : 0;
      return {
        promoter: promoterById.get(id) || { _id: id, displayName: "Promoter" },
        views: v.views || 0,
        uniqueViews: v.uniqueViews || 0,
        clicks: c.clicks || 0,
        uniqueClicks: c.uniqueClicks || 0,
        clickThroughRate: ctr,
        paidOrders: o.paidOrders || 0,
        totalOrders: o.totalOrders || 0,
        pendingOrders: o.pendingOrders || 0,
        fulfilledOrders: o.fulfilledOrders || 0,
        refundedOrders: o.refundedOrders || 0,
        revenue: o.revenue || 0,
        commission: o.commission || 0,
        commissionPaid: o.commissionPaid || 0,
        conversionRate: cvr,
        lastActivityAt: c.lastClickAt || v.lastViewAt || null,
      };
    })
    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
    .slice(0, lim);

  return { productId: productObjectId, rows };
}
