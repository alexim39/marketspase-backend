import mongoose from "mongoose";
import { StoreCustomerModel } from "../../models/store-customer/index.js";
import { StoreModel } from "../../models/store/index.js";
import { OrderModel } from "../../models/order/index.js";

const CUSTOMER_STAGE_VALUES = ["all", "new", "active", "repeat", "vip", "at_risk", "suppressed"];
const CONTACT_CHANNEL_VALUES = ["email", "sms", "manual"];
const SORTABLE_FIELDS = new Map([
  ["lastOrderAt", "lastOrderAt"],
  ["totalSpent", "totalSpent"],
  ["orderCount", "orderCount"],
  ["firstSeenAt", "firstSeenAt"],
  ["fullName", "fullName"],
  ["linkedStoreCount", "linkedStoreCount"],
]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBooleanQuery(value) {
  if (value === undefined || value === null || value === "" || value === "all") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).toLowerCase();
  if (["true", "1", "yes", "opted_in"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "opted_out"].includes(normalized)) {
    return false;
  }

  return null;
}

function parsePage(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseLimit(value, fallback = 20, max = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function parseSort(sortBy = "lastOrderAt", sortOrder = "desc") {
  const field = SORTABLE_FIELDS.get(sortBy) || "lastOrderAt";
  const order = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;

  return { [field]: order, email: 1 };
}

function toObjectId(value) {
  return value?._id || value;
}

function toIdString(value) {
  const raw = toObjectId(value);
  return raw?.toString?.() || "";
}

function isAdminRequest(req) {
  return ["admin", "super-admin"].includes(req.user?.role);
}

function resolveSegment(buyer) {
  if (buyer.lifecycleStage === "suppressed" || buyer.marketingOptIn === false) {
    return "suppressed";
  }

  if ((buyer.orderCount || 0) >= 4 || (buyer.totalSpent || 0) >= 200000) {
    return "vip";
  }

  if ((buyer.orderCount || 0) > 1) {
    return "repeat";
  }

  if (buyer.lastOrderAt) {
    const ageMs = Date.now() - new Date(buyer.lastOrderAt).getTime();
    const days = ageMs / (1000 * 60 * 60 * 24);
    if (days >= 90) {
      return "at_risk";
    }
  }

  if (buyer.lifecycleStage && buyer.lifecycleStage !== "new") {
    return buyer.lifecycleStage;
  }

  return "new";
}

function buildBaseMatch({ marketerId, storeId, lifecycleStage, marketingOptIn, customerType }) {
  const match = {};

  if (marketerId) {
    match.marketer = new mongoose.Types.ObjectId(marketerId);
  }

  if (storeId) {
    match.store = new mongoose.Types.ObjectId(storeId);
  }

  if (lifecycleStage && lifecycleStage !== "all") {
    match.lifecycleStage = lifecycleStage;
  }

  if (marketingOptIn !== null) {
    match.marketingOptIn = marketingOptIn;
  }

  if (customerType && customerType !== "all") {
    match.customerType = customerType;
  }

  return match;
}

function buildSearchMatch(search) {
  const trimmed = normalizeString(search);
  if (!trimmed) {
    return [];
  }

  const regex = new RegExp(escapeRegex(trimmed), "i");
  return [{
    $match: {
      $or: [
        { email: regex },
        { fullName: regex },
        { phone: regex },
        { tags: regex },
      ],
    },
  }];
}

function buildAggregatePipeline({
  marketerId = null,
  storeId = null,
  search = "",
  lifecycleStage = "all",
  marketingOptIn = null,
  customerType = "all",
  segment = "all",
  sortBy = "lastOrderAt",
  sortOrder = "desc",
  page = 1,
  limit = 20,
  includeMarketers = false,
}) {
  const baseMatch = buildBaseMatch({ marketerId, storeId, lifecycleStage, marketingOptIn, customerType });
  const searchStages = buildSearchMatch(search);
  const sort = parseSort(sortBy, sortOrder);
  const skip = (page - 1) * limit;
  const atRiskCutoff = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));

  const postLookupStages = [];
  const normalizedSegment = segment && segment !== "all" ? segment : null;

  if (normalizedSegment) {
    postLookupStages.push({
      $match: {
        behaviorSegment: normalizedSegment,
      },
    });
  }

  return [
    { $match: baseMatch },
    ...searchStages,
    { $sort: { lastOrderAt: -1, updatedAt: -1 } },
    {
      $group: {
        _id: "$email",
        email: { $first: "$email" },
        fullName: { $first: "$fullName" },
        phone: { $first: "$phone" },
        notes: { $first: "$notes" },
        lifecycleStage: { $first: "$lifecycleStage" },
        preferredChannels: { $first: "$preferredChannels" },
        lastContactedAt: { $first: "$lastContactedAt" },
        lastContactChannel: { $first: "$lastContactChannel" },
        lastCampaignName: { $first: "$lastCampaignName" },
        source: { $first: "$source" },
        firstTrackingCode: { $first: "$firstTrackingCode" },
        firstTrackingRef: { $first: "$firstTrackingRef" },
        lastTrackingCode: { $first: "$lastTrackingCode" },
        lastTrackingRef: { $first: "$lastTrackingRef" },
        marketingOptInFlag: {
          $min: {
            $cond: [{ $eq: ["$marketingOptIn", false] }, 0, 1],
          },
        },
        orderCount: { $sum: { $ifNull: ["$orderCount", 0] } },
        totalSpent: { $sum: { $ifNull: ["$totalSpent", 0] } },
        firstSeenAt: { $min: "$firstSeenAt" },
        lastOrderAt: { $max: "$lastOrderAt" },
        linkedStoreIds: { $addToSet: "$store" },
        linkedMarketerIds: { $addToSet: "$marketer" },
        customerIds: { $addToSet: "$customer" },
        customerTypes: { $addToSet: "$customerType" },
        tagsMatrix: { $push: { $ifNull: ["$tags", []] } },
        activityLog: { $first: "$activityLog" },
      },
    },
    {
      $addFields: {
        lifecycleStage: { $ifNull: ["$lifecycleStage", "new"] },
        preferredChannels: { $ifNull: ["$preferredChannels", []] },
        fullName: { $ifNull: ["$fullName", "$email"] },
        phone: { $ifNull: ["$phone", ""] },
        tags: {
          $reduce: {
            input: "$tagsMatrix",
            initialValue: [],
            in: { $setUnion: ["$$value", "$$this"] },
          },
        },
        marketingOptIn: { $eq: ["$marketingOptInFlag", 1] },
        linkedStoreCount: { $size: "$linkedStoreIds" },
        linkedMarketerCount: { $size: "$linkedMarketerIds" },
        averageOrderValue: {
          $cond: [
            { $gt: ["$orderCount", 0] },
            { $divide: ["$totalSpent", "$orderCount"] },
            0,
          ],
        },
        hasRegisteredAccount: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$customerIds",
                  as: "customerId",
                  cond: { $ne: ["$$customerId", null] },
                },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        behaviorSegment: {
          $switch: {
            branches: [
              {
                case: {
                  $or: [
                    { $eq: ["$lifecycleStage", "suppressed"] },
                    { $eq: ["$marketingOptIn", false] },
                  ],
                },
                then: "suppressed",
              },
              {
                case: {
                  $or: [
                    { $gte: ["$orderCount", 4] },
                    { $gte: ["$totalSpent", 200000] },
                  ],
                },
                then: "vip",
              },
              {
                case: { $gt: ["$orderCount", 1] },
                then: "repeat",
              },
              {
                case: {
                  $and: [
                    { $ne: ["$lastOrderAt", null] },
                    { $lt: ["$lastOrderAt", atRiskCutoff] },
                  ],
                },
                then: "at_risk",
              },
            ],
            default: "new",
          },
        },
      },
    },
    {
      $lookup: {
        from: "stores",
        localField: "linkedStoreIds",
        foreignField: "_id",
        as: "linkedStores",
      },
    },
    ...(includeMarketers ? [{
      $lookup: {
        from: "users",
        localField: "linkedMarketerIds",
        foreignField: "_id",
        as: "linkedMarketers",
      },
    }] : []),
    ...postLookupStages,
    {
      $facet: {
        customers: [
          { $sort: sort },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              buyerKey: "$email",
              email: 1,
              fullName: 1,
              phone: 1,
              notes: 1,
              lifecycleStage: 1,
              preferredChannels: 1,
              lastContactedAt: 1,
              lastContactChannel: 1,
              lastCampaignName: 1,
              source: 1,
              firstTrackingCode: 1,
              firstTrackingRef: 1,
              lastTrackingCode: 1,
              lastTrackingRef: 1,
              marketingOptIn: 1,
              orderCount: 1,
              totalSpent: 1,
              averageOrderValue: 1,
              firstSeenAt: 1,
              lastOrderAt: 1,
              linkedStoreCount: 1,
              linkedMarketerCount: 1,
              hasRegisteredAccount: 1,
              customerTypes: 1,
              tags: 1,
              activityLog: 1,
              behaviorSegment: 1,
              linkedStores: {
                $map: {
                  input: "$linkedStores",
                  as: "store",
                  in: {
                    _id: "$$store._id",
                    name: "$$store.name",
                    storeLink: "$$store.storeLink",
                    logo: "$$store.logo",
                  },
                },
              },
              linkedMarketers: includeMarketers ? {
                $map: {
                  input: "$linkedMarketers",
                  as: "marketer",
                  in: {
                    _id: "$$marketer._id",
                    displayName: "$$marketer.displayName",
                    username: "$$marketer.username",
                    email: "$$marketer.email",
                  },
                },
              } : [],
            },
          },
        ],
        pagination: [{ $count: "total" }],
        summary: [
          {
            $group: {
              _id: null,
              totalCustomers: { $sum: 1 },
              optedInCustomers: {
                $sum: { $cond: [{ $eq: ["$marketingOptIn", true] }, 1, 0] },
              },
              repeatCustomers: {
                $sum: { $cond: [{ $gt: ["$orderCount", 1] }, 1, 0] },
              },
              vipCustomers: {
                $sum: { $cond: [{ $eq: ["$behaviorSegment", "vip"] }, 1, 0] },
              },
              suppressedCustomers: {
                $sum: { $cond: [{ $eq: ["$behaviorSegment", "suppressed"] }, 1, 0] },
              },
              totalRevenue: { $sum: "$totalSpent" },
              totalOrders: { $sum: "$orderCount" },
              linkedStores: { $sum: "$linkedStoreCount" },
            },
          },
          {
            $project: {
              _id: 0,
              totalCustomers: 1,
              optedInCustomers: 1,
              repeatCustomers: 1,
              vipCustomers: 1,
              suppressedCustomers: 1,
              totalRevenue: 1,
              totalOrders: 1,
              linkedStores: 1,
              averageOrderValue: {
                $cond: [
                  { $gt: ["$totalOrders", 0] },
                  { $divide: ["$totalRevenue", "$totalOrders"] },
                  0,
                ],
              },
            },
          },
        ],
        storeOptions: [
          { $unwind: "$linkedStores" },
          {
            $group: {
              _id: "$linkedStores._id",
              name: { $first: "$linkedStores.name" },
              storeLink: { $first: "$linkedStores.storeLink" },
            },
          },
          { $sort: { name: 1 } },
          { $limit: 200 },
        ],
        ...(includeMarketers ? {
          marketerOptions: [
            { $unwind: "$linkedMarketers" },
            {
              $group: {
                _id: "$linkedMarketers._id",
                displayName: { $first: "$linkedMarketers.displayName" },
                username: { $first: "$linkedMarketers.username" },
                email: { $first: "$linkedMarketers.email" },
              },
            },
            { $sort: { displayName: 1, username: 1 } },
            { $limit: 200 },
          ],
        } : {}),
      },
    },
  ];
}

function buildOrderMatch({ marketerId = null, email, customerIds = [], storeIds = [] }) {
  const orClauses = [
    { "guestCustomer.email": email },
    { "shippingAddress.email": email },
  ];

  const normalizedCustomerIds = customerIds.filter(Boolean);
  if (normalizedCustomerIds.length > 0) {
    orClauses.push({ customer: { $in: normalizedCustomerIds } });
  }

  const match = {
    isDeleted: false,
    $or: orClauses,
  };

  if (marketerId) {
    match.marketer = new mongoose.Types.ObjectId(marketerId);
  }

  if (storeIds.length > 0) {
    match.store = { $in: storeIds };
  }

  return match;
}

function buildBuyerDetail(records, orders, { includeMarketers = false } = {}) {
  const tags = [...new Set(records.flatMap((record) => record.tags || []).filter(Boolean))];
  const linkedStores = records.map((record) => record.store).filter(Boolean);
  const linkedMarketers = includeMarketers
    ? [...new Map(records.map((record) => [toIdString(record.marketer), record.marketer]).filter(([, marketer]) => marketer)).values()]
    : [];

  const totalSpent = records.reduce((sum, record) => sum + Number(record.totalSpent || 0), 0);
  const orderCount = records.reduce((sum, record) => sum + Number(record.orderCount || 0), 0);
  const latestRecord = [...records].sort((a, b) => new Date(b.lastOrderAt || b.updatedAt || 0).getTime() - new Date(a.lastOrderAt || a.updatedAt || 0).getTime())[0] || null;
  const latestOrder = orders[0] || null;

  const buyer = {
    buyerKey: normalizeEmail(latestRecord?.email),
    email: normalizeEmail(latestRecord?.email),
    fullName: latestRecord?.fullName || latestOrder?.shippingAddress?.fullName || "Buyer",
    phone: latestRecord?.phone || latestOrder?.shippingAddress?.phone || "",
    notes: latestRecord?.notes || "",
    lifecycleStage: latestRecord?.lifecycleStage || "new",
    preferredChannels: latestRecord?.preferredChannels || [],
    lastContactedAt: latestRecord?.lastContactedAt || null,
    lastContactChannel: latestRecord?.lastContactChannel || "",
    lastCampaignName: latestRecord?.lastCampaignName || "",
    marketingOptIn: records.every((record) => record.marketingOptIn !== false),
    firstSeenAt: records.reduce((min, record) => {
      if (!min) return record.firstSeenAt || null;
      if (!record.firstSeenAt) return min;
      return new Date(record.firstSeenAt).getTime() < new Date(min).getTime() ? record.firstSeenAt : min;
    }, null),
    lastOrderAt: latestRecord?.lastOrderAt || latestOrder?.createdAt || null,
    totalSpent,
    orderCount,
    averageOrderValue: orderCount > 0 ? totalSpent / orderCount : 0,
    linkedStoreCount: linkedStores.length,
    linkedStores: linkedStores.map((store) => ({
      _id: store._id,
      name: store.name,
      storeLink: store.storeLink,
      logo: store.logo,
    })),
    linkedMarketers: linkedMarketers.map((marketer) => ({
      _id: marketer._id,
      displayName: marketer.displayName,
      username: marketer.username,
      email: marketer.email,
    })),
    tags,
    customerTypes: [...new Set(records.map((record) => record.customerType).filter(Boolean))],
    hasRegisteredAccount: records.some((record) => record.customer),
    source: latestRecord?.source || "storefront_checkout",
    behaviorSegment: resolveSegment({
      lifecycleStage: latestRecord?.lifecycleStage || "new",
      marketingOptIn: records.every((record) => record.marketingOptIn !== false),
      orderCount,
      totalSpent,
      lastOrderAt: latestRecord?.lastOrderAt || latestOrder?.createdAt || null,
    }),
    lastKnownLocation: latestOrder?.shippingAddress ? {
      city: latestOrder.shippingAddress.city,
      state: latestOrder.shippingAddress.state,
      country: latestOrder.shippingAddress.country,
    } : null,
  };

  const storeRecords = records.map((record) => ({
    _id: record._id,
    store: record.store ? {
      _id: record.store._id,
      name: record.store.name,
      storeLink: record.store.storeLink,
      logo: record.store.logo,
    } : null,
    orderCount: Number(record.orderCount || 0),
    totalSpent: Number(record.totalSpent || 0),
    lastOrderAt: record.lastOrderAt || null,
    firstSeenAt: record.firstSeenAt || null,
    customerType: record.customerType || "guest",
    marketingOptIn: record.marketingOptIn !== false,
    tags: record.tags || [],
    source: record.source || "storefront_checkout",
  }));

  const orderItems = orders.map((order) => ({
    _id: order._id,
    orderNumber: order.orderNumber,
    totalAmount: Number(order.totalAmount || 0),
    currency: order.currency || "NGN",
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    escrowStatus: order.escrowStatus,
    paidAt: order.paidAt || null,
    createdAt: order.createdAt || null,
    deliveredAt: order.deliveredAt || null,
    shippingAddress: order.shippingAddress || null,
    store: order.store ? {
      _id: order.store._id,
      name: order.store.name,
      storeLink: order.store.storeLink,
      logo: order.store.logo,
    } : null,
    items: (order.items || []).map((item) => ({
      _id: item._id,
      name: item.product?.name || "Product",
      quantity: Number(item.quantity || 0),
      totalPrice: Number(item.totalPrice || 0),
      commissionEarned: Number(item.commissionEarned || 0),
      promoterId: item.promoterId ? {
        _id: item.promoterId._id,
        displayName: item.promoterId.displayName,
        username: item.promoterId.username,
      } : null,
    })),
  }));

  return {
    buyer,
    storeRecords,
    orders: orderItems,
  };
}

async function getStoreOptionsForMarketer(marketerId) {
  return StoreModel.find({ owner: marketerId, isDeleted: { $ne: true } })
    .select("name storeLink logo")
    .sort({ name: 1 })
    .lean();
}

async function runBuyerAggregate(options) {
  const [result] = await StoreCustomerModel.aggregate(buildAggregatePipeline(options));
  const paginationTotal = result?.pagination?.[0]?.total || 0;
  const summary = result?.summary?.[0] || {
    totalCustomers: 0,
    optedInCustomers: 0,
    repeatCustomers: 0,
    vipCustomers: 0,
    suppressedCustomers: 0,
    totalRevenue: 0,
    totalOrders: 0,
    linkedStores: 0,
    averageOrderValue: 0,
  };

  return {
    customers: result?.customers || [],
    pagination: {
      page: options.page,
      limit: options.limit,
      total: paginationTotal,
      totalPages: paginationTotal > 0 ? Math.ceil(paginationTotal / options.limit) : 1,
    },
    summary,
    storeOptions: result?.storeOptions || [],
    marketerOptions: result?.marketerOptions || [],
  };
}

export const getMarketerCustomers = async (req, res) => {
  try {
    const { marketerId } = req.params;
    const {
      storeId,
      search = "",
      lifecycleStage = "all",
      marketingOptIn = "all",
      customerType = "all",
      segment = "all",
      sortBy = "lastOrderAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(marketerId)) {
      return res.status(400).json({ success: false, message: "Invalid marketer ID" });
    }

    if (storeId && !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ success: false, message: "Invalid store ID" });
    }

    if (!isAdminRequest(req) && marketerId !== req.userId) {
      return res.status(403).json({ success: false, message: "You are not allowed to view these customers" });
    }

    const normalizedStage = CUSTOMER_STAGE_VALUES.includes(String(lifecycleStage)) ? String(lifecycleStage) : "all";
    const normalizedOptIn = parseBooleanQuery(marketingOptIn);
    const normalizedCustomerType = ["all", "guest", "registered"].includes(String(customerType)) ? String(customerType) : "all";
    const normalizedSegment = ["all", "new", "repeat", "vip", "at_risk", "suppressed"].includes(String(segment)) ? String(segment) : "all";
    const normalizedPage = parsePage(page, 1);
    const normalizedLimit = parseLimit(limit, 20, 100);

    const aggregateResult = await runBuyerAggregate({
      marketerId,
      storeId,
      search,
      lifecycleStage: normalizedStage,
      marketingOptIn: normalizedOptIn,
      customerType: normalizedCustomerType,
      segment: normalizedSegment,
      sortBy,
      sortOrder,
      page: normalizedPage,
      limit: normalizedLimit,
      includeMarketers: false,
    });

    const storeOptions = aggregateResult.storeOptions?.length
      ? aggregateResult.storeOptions
      : await getStoreOptionsForMarketer(marketerId);

    return res.status(200).json({
      success: true,
      data: {
        customers: aggregateResult.customers,
        pagination: aggregateResult.pagination,
        summary: aggregateResult.summary,
        filters: {
          stores: storeOptions,
        },
      },
    });
  } catch (error) {
    console.error("Get marketer customers error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch customers" });
  }
};

export const getMarketerCustomerDetail = async (req, res) => {
  try {
    const { marketerId } = req.params;
    const email = normalizeEmail(req.query.email);

    if (!mongoose.Types.ObjectId.isValid(marketerId)) {
      return res.status(400).json({ success: false, message: "Invalid marketer ID" });
    }

    if (!email) {
      return res.status(400).json({ success: false, message: "Customer email is required" });
    }

    if (!isAdminRequest(req) && marketerId !== req.userId) {
      return res.status(403).json({ success: false, message: "You are not allowed to view this customer" });
    }

    const records = await StoreCustomerModel.find({
      marketer: marketerId,
      email,
    })
      .populate("store", "name storeLink logo owner")
      .populate("marketer", "displayName username email")
      .populate("customer", "displayName username email personalInfo")
      .sort({ lastOrderAt: -1, updatedAt: -1 })
      .lean();

    if (!records.length) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const customerIds = records.map((record) => record.customer?._id).filter(Boolean);
    const storeIds = records.map((record) => record.store?._id).filter(Boolean);

    const orders = await OrderModel.find(buildOrderMatch({ marketerId, email, customerIds, storeIds }))
      .populate("store", "name storeLink logo owner")
      .populate("items.product", "name images price")
      .populate("items.promoterId", "displayName username email")
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    return res.status(200).json({
      success: true,
      data: buildBuyerDetail(records, orders),
    });
  } catch (error) {
    console.error("Get marketer customer detail error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch customer detail" });
  }
};

export const updateMarketerCustomerMeta = async (req, res) => {
  try {
    const { marketerId } = req.params;
    const email = normalizeEmail(req.body.email);

    if (!mongoose.Types.ObjectId.isValid(marketerId)) {
      return res.status(400).json({ success: false, message: "Invalid marketer ID" });
    }

    if (!email) {
      return res.status(400).json({ success: false, message: "Customer email is required" });
    }

    if (!isAdminRequest(req) && marketerId !== req.userId) {
      return res.status(403).json({ success: false, message: "You are not allowed to update this customer" });
    }

    const updates = {};
    const addToSet = {};
    const pull = {};

    const lifecycleStage = normalizeString(req.body.lifecycleStage);
    if (lifecycleStage && CUSTOMER_STAGE_VALUES.includes(lifecycleStage) && lifecycleStage !== "all") {
      updates.lifecycleStage = lifecycleStage;
    }

    if (req.body.notes !== undefined) {
      updates.notes = normalizeString(req.body.notes);
    }

    const marketingOptIn = parseBooleanQuery(req.body.marketingOptIn);
    if (marketingOptIn !== null) {
      updates.marketingOptIn = marketingOptIn;
    }

    if (Array.isArray(req.body.preferredChannels)) {
      updates.preferredChannels = req.body.preferredChannels
        .map((value) => normalizeString(value))
        .filter((value) => CONTACT_CHANNEL_VALUES.includes(value));
    }

    if (req.body.lastContactChannel) {
      const channel = normalizeString(req.body.lastContactChannel);
      if (CONTACT_CHANNEL_VALUES.includes(channel)) {
        updates.lastContactChannel = channel;
        updates.lastContactedAt = req.body.lastContactedAt ? new Date(req.body.lastContactedAt) : new Date();
      }
    }

    if (req.body.lastCampaignName !== undefined) {
      updates.lastCampaignName = normalizeString(req.body.lastCampaignName);
    }

    const tagsToAdd = Array.isArray(req.body.addTags)
      ? req.body.addTags.map((value) => normalizeString(value)).filter(Boolean)
      : [];
    if (tagsToAdd.length > 0) {
      addToSet.tags = { $each: tagsToAdd };
    }

    const tagsToRemove = Array.isArray(req.body.removeTags)
      ? req.body.removeTags.map((value) => normalizeString(value)).filter(Boolean)
      : [];
    if (tagsToRemove.length > 0) {
      pull.tags = { $in: tagsToRemove };
    }

    const updateDocument = {};
    if (Object.keys(updates).length > 0) {
      updateDocument.$set = updates;
    }
    if (Object.keys(addToSet).length > 0) {
      updateDocument.$addToSet = addToSet;
    }
    if (Object.keys(pull).length > 0) {
      updateDocument.$pull = pull;
    }

    if (!Object.keys(updateDocument).length) {
      return res.status(400).json({ success: false, message: "No valid customer updates were provided" });
    }

    const result = await StoreCustomerModel.updateMany(
      { marketer: marketerId, email },
      updateDocument
    );

    if (!result.matchedCount) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Customer record updated successfully",
    });
  } catch (error) {
    console.error("Update marketer customer meta error:", error);
    return res.status(500).json({ success: false, message: "Failed to update customer record" });
  }
};

export const getAdminBuyers = async (req, res) => {
  try {
    const {
      marketerId,
      storeId,
      search = "",
      lifecycleStage = "all",
      marketingOptIn = "all",
      customerType = "all",
      segment = "all",
      sortBy = "lastOrderAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    if (marketerId && !mongoose.Types.ObjectId.isValid(marketerId)) {
      return res.status(400).json({ success: false, message: "Invalid marketer ID" });
    }

    if (storeId && !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ success: false, message: "Invalid store ID" });
    }

    const normalizedStage = CUSTOMER_STAGE_VALUES.includes(String(lifecycleStage)) ? String(lifecycleStage) : "all";
    const normalizedOptIn = parseBooleanQuery(marketingOptIn);
    const normalizedCustomerType = ["all", "guest", "registered"].includes(String(customerType)) ? String(customerType) : "all";
    const normalizedSegment = ["all", "new", "repeat", "vip", "at_risk", "suppressed"].includes(String(segment)) ? String(segment) : "all";
    const normalizedPage = parsePage(page, 1);
    const normalizedLimit = parseLimit(limit, 20, 100);

    const aggregateResult = await runBuyerAggregate({
      marketerId,
      storeId,
      search,
      lifecycleStage: normalizedStage,
      marketingOptIn: normalizedOptIn,
      customerType: normalizedCustomerType,
      segment: normalizedSegment,
      sortBy,
      sortOrder,
      page: normalizedPage,
      limit: normalizedLimit,
      includeMarketers: true,
    });

    return res.status(200).json({
      success: true,
      data: {
        buyers: aggregateResult.customers,
        pagination: aggregateResult.pagination,
        summary: aggregateResult.summary,
        filters: {
          stores: aggregateResult.storeOptions || [],
          marketers: aggregateResult.marketerOptions || [],
        },
      },
    });
  } catch (error) {
    console.error("Get admin buyers error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch buyers" });
  }
};

export const getAdminBuyerDetail = async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);

    if (!email) {
      return res.status(400).json({ success: false, message: "Buyer email is required" });
    }

    const records = await StoreCustomerModel.find({ email })
      .populate("store", "name storeLink logo owner")
      .populate("marketer", "displayName username email")
      .populate("customer", "displayName username email personalInfo")
      .sort({ lastOrderAt: -1, updatedAt: -1 })
      .lean();

    if (!records.length) {
      return res.status(404).json({ success: false, message: "Buyer not found" });
    }

    const customerIds = records.map((record) => record.customer?._id).filter(Boolean);
    const storeIds = records.map((record) => record.store?._id).filter(Boolean);

    const orders = await OrderModel.find(buildOrderMatch({ email, customerIds, storeIds }))
      .populate("store", "name storeLink logo owner")
      .populate("items.product", "name images price")
      .populate("items.promoterId", "displayName username email")
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();

    return res.status(200).json({
      success: true,
      data: buildBuyerDetail(records, orders, { includeMarketers: true }),
    });
  } catch (error) {
    console.error("Get admin buyer detail error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch buyer detail" });
  }
};

export const updateAdminBuyerMeta = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const marketerId = req.body.marketerId && mongoose.Types.ObjectId.isValid(req.body.marketerId)
      ? req.body.marketerId
      : null;

    if (!email) {
      return res.status(400).json({ success: false, message: "Buyer email is required" });
    }

    const updates = {};
    const addToSet = {};
    const pull = {};

    const lifecycleStage = normalizeString(req.body.lifecycleStage);
    if (lifecycleStage && CUSTOMER_STAGE_VALUES.includes(lifecycleStage) && lifecycleStage !== "all") {
      updates.lifecycleStage = lifecycleStage;
    }

    if (req.body.notes !== undefined) {
      updates.notes = normalizeString(req.body.notes);
    }

    const marketingOptIn = parseBooleanQuery(req.body.marketingOptIn);
    if (marketingOptIn !== null) {
      updates.marketingOptIn = marketingOptIn;
    }

    if (Array.isArray(req.body.preferredChannels)) {
      updates.preferredChannels = req.body.preferredChannels
        .map((value) => normalizeString(value))
        .filter((value) => CONTACT_CHANNEL_VALUES.includes(value));
    }

    if (req.body.lastContactChannel) {
      const channel = normalizeString(req.body.lastContactChannel);
      if (CONTACT_CHANNEL_VALUES.includes(channel)) {
        updates.lastContactChannel = channel;
        updates.lastContactedAt = req.body.lastContactedAt ? new Date(req.body.lastContactedAt) : new Date();
      }
    }

    if (req.body.lastCampaignName !== undefined) {
      updates.lastCampaignName = normalizeString(req.body.lastCampaignName);
    }

    const tagsToAdd = Array.isArray(req.body.addTags)
      ? req.body.addTags.map((value) => normalizeString(value)).filter(Boolean)
      : [];
    if (tagsToAdd.length > 0) {
      addToSet.tags = { $each: tagsToAdd };
    }

    const tagsToRemove = Array.isArray(req.body.removeTags)
      ? req.body.removeTags.map((value) => normalizeString(value)).filter(Boolean)
      : [];
    if (tagsToRemove.length > 0) {
      pull.tags = { $in: tagsToRemove };
    }

    const updateDocument = {};
    if (Object.keys(updates).length > 0) {
      updateDocument.$set = updates;
    }
    if (Object.keys(addToSet).length > 0) {
      updateDocument.$addToSet = addToSet;
    }
    if (Object.keys(pull).length > 0) {
      updateDocument.$pull = pull;
    }

    if (!Object.keys(updateDocument).length) {
      return res.status(400).json({ success: false, message: "No valid buyer updates were provided" });
    }

    const filter = marketerId ? { email, marketer: marketerId } : { email };
    const result = await StoreCustomerModel.updateMany(filter, updateDocument);

    if (!result.matchedCount) {
      return res.status(404).json({ success: false, message: "Buyer not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Buyer record updated successfully",
    });
  } catch (error) {
    console.error("Update admin buyer meta error:", error);
    return res.status(500).json({ success: false, message: "Failed to update buyer record" });
  }
};

// ---------- SMS Sending for Store Customers ----------

export const sendCustomerSms = async (req, res) => {
  try {
    const { marketerId } = req.params;
    const { email, phone, message } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message is required.' });
    if (!phone) return res.status(400).json({ success: false, message: 'Customer has no phone number.' });

    const customer = await StoreCustomerModel.findOne({ email, marketer: marketerId });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const { chargeMarketerForSms } = await import('../../../../customer-crm/controllers/customer.controller.js').catch(() => ({}));
    const { sendSms: deliverSms } = await import('../../../../customer-crm/services/sms.service.js').catch(() => ({}));
    const { default: SmsHistoryModel } = await import('../../../../customer-crm/models/sms-history.model.js').catch(() => ({}));

    const SMS_COST = 10;
    if (chargeMarketerForSms) {
      const charged = await chargeMarketerForSms(req.userId, 1);
      if (!charged) return res.status(402).json({ success: false, message: `Insufficient balance. SMS costs ₦${SMS_COST}.`, code: 'INSUFFICIENT_BALANCE' });
    }

    const result = deliverSms ? await deliverSms(phone, message.trim()) : null;

    await StoreCustomerModel.updateOne({ _id: customer._id }, {
      $set: { lastContactedAt: new Date(), lastContactChannel: 'sms', lastCampaignName: 'SMS outreach' },
      $push: { activityLog: { type: 'sms', message: message.trim().substring(0, 200), channel: 'sms', createdAt: new Date() } },
    });

    if (SmsHistoryModel) {
      const pageCount = Math.ceil(message.trim().length / 160);
      await SmsHistoryModel.create({
        sender: req.userId, contact: customer._id, message: message.trim(),
        messageLength: message.trim().length, pageCount, costPerPage: SMS_COST,
        totalCost: SMS_COST, status: 'sent',
      });
    }

    return res.status(200).json({ success: true, message: 'SMS sent.', data: { reference: result?.reference } });
  } catch (e) {
    console.error('Store customer SMS error:', e);
    return res.status(500).json({ success: false, message: e.message || 'Failed to send SMS.' });
  }
};

export const sendBulkCustomerSms = async (req, res) => {
  try {
    const { marketerId } = req.params;
    const { emails, message } = req.body;
    if (!Array.isArray(emails) || !emails.length) return res.status(400).json({ success: false, message: 'Recipient list required.' });
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message is required.' });

    const customers = await StoreCustomerModel.find({ email: { $in: emails }, marketer: marketerId, phone: { $exists: true, $ne: '' } }).lean();
    if (!customers.length) return res.status(400).json({ success: false, message: 'No valid recipients with phone numbers.' });

    const { chargeMarketerForSms } = await import('../../../../customer-crm/controllers/customer.controller.js').catch(() => ({}));
    const { sendSms: deliverSms } = await import('../../../../customer-crm/services/sms.service.js').catch(() => ({}));
    const { default: SmsHistoryModel } = await import('../../../../customer-crm/models/sms-history.model.js').catch(() => ({}));

    const SMS_COST = 10;
    if (chargeMarketerForSms) {
      const charged = await chargeMarketerForSms(req.userId, customers.length);
      if (!charged) return res.status(402).json({ success: false, message: `Insufficient balance. Bulk SMS costs ₦${SMS_COST * customers.length}.`, code: 'INSUFFICIENT_BALANCE' });
    }

    for (const c of customers) {
      try {
        if (deliverSms) await deliverSms(c.phone, message.trim());
        if (SmsHistoryModel) {
          const pc = Math.ceil(message.trim().length / 160);
          await SmsHistoryModel.create({
            sender: req.userId, contact: c._id, message: message.trim(),
            messageLength: message.trim().length, pageCount: pc, costPerPage: SMS_COST,
            totalCost: SMS_COST, status: 'sent',
          });
        }
      } catch (err) { /* skip failed */ }
    }

    await StoreCustomerModel.updateMany({ _id: { $in: customers.map(c => c._id) } }, {
      $set: { lastContactedAt: new Date(), lastContactChannel: 'sms', lastCampaignName: 'Bulk SMS' },
      $push: { activityLog: { type: 'sms', message: message.trim().substring(0, 200), channel: 'sms', createdAt: new Date() } },
    });

    return res.status(200).json({ success: true, message: `SMS sent to ${customers.length} recipients.` });
  } catch (e) {
    console.error('Bulk store customer SMS error:', e);
    return res.status(500).json({ success: false, message: e.message || 'Failed to send bulk SMS.' });
  }
};
