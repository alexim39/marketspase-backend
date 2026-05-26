import mongoose from "mongoose";
import { StoreModel } from "../models/store/index.js";
import { StoreSubscriberModel } from "../models/store-subscriber/index.js";
import { detectDeviceType, getClientIp, hashIp } from "./storefront-affiliate.service.js";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");
const normalizeEmail = (value) => normalizeString(value).toLowerCase();
const clampString = (value, maxLen = 600) => normalizeString(value).slice(0, maxLen);

const parsePage = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseLimit = (value, fallback = 20, max = 200) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sanitizeMetadata = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  // Public endpoint: keep payload small and predictable.
  const allowedKeys = new Set(["storeLink", "campaign", "promotion", "page"]);
  const entries = Object.entries(value).slice(0, 20);
  const next = {};

  for (const [key, raw] of entries) {
    if (!allowedKeys.has(key)) continue;
    if (raw === null || raw === undefined) continue;

    if (typeof raw === "string") {
      next[key] = raw.slice(0, 200);
      continue;
    }

    if (typeof raw === "number" || typeof raw === "boolean") {
      next[key] = raw;
    }
  }

  return next;
};

export const validateSubscriberPayload = ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
    const error = new Error("Invalid email address");
    error.status = 400;
    throw error;
  }
  return { email: normalizedEmail };
};

export const subscribeStoreEmail = async ({
  storeId,
  email,
  source = "storefront",
  referrer = "",
  metadata = {},
  req,
}) => {
  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    const error = new Error("Invalid store id");
    error.status = 400;
    throw error;
  }

  const store = await StoreModel.findOne({ _id: storeId, isDeleted: { $ne: true } })
    .select("_id owner storeLink name")
    .lean();

  if (!store?._id) {
    const error = new Error("Store not found");
    error.status = 404;
    throw error;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
    const error = new Error("Invalid email address");
    error.status = 400;
    throw error;
  }

  const userAgent = normalizeString(req?.headers?.["user-agent"] || "").slice(0, 600);
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const deviceType = userAgent ? detectDeviceType(userAgent) : "unknown";
  const now = new Date();

  const updateDoc = {
    $setOnInsert: {
      firstSubscribedAt: now,
    },
    $set: {
      store: store._id,
      storeOwner: store.owner,
      email: normalizedEmail,
      status: "subscribed",
      source: clampString(source, 60) || "storefront",
      referrer: clampString(referrer || req?.headers?.referer || "", 600),
      ipHash,
      deviceType,
      userAgent,
      metadata: sanitizeMetadata(metadata),
      subscribedAt: now,
      // If an admin previously removed this subscriber, revive on re-subscribe.
      isDeleted: false,
    },
    $unset: { unsubscribedAt: 1, deletedAt: 1, deletedBy: 1, deleteReason: 1 },
  };

  let rawResult;
  try {
    rawResult = await StoreSubscriberModel.findOneAndUpdate(
      { store: store._id, email: normalizedEmail },
      updateDoc,
      { new: true, upsert: true, rawResult: true }
    );
  } catch (err) {
    // If two upserts race on the same unique index, Mongo may throw E11000.
    // Treat it as "already exists" and return the latest doc.
    if (err?.code === 11000) {
      rawResult = await StoreSubscriberModel.findOneAndUpdate(
        { store: store._id, email: normalizedEmail },
        updateDoc,
        { new: true, upsert: false, rawResult: true }
      );
    } else {
      throw err;
    }
  }

  const subscriber = rawResult?.value || null;
  const created = rawResult?.lastErrorObject?.updatedExisting === false;

  return {
    subscriber,
    created,
    store: {
      _id: store._id,
      name: store.name,
      storeLink: store.storeLink,
    },
  };
};

export const listOwnerSubscribers = async ({
  ownerId,
  storeId = null,
  search = "",
  status = "all",
  source = "all",
  startDate = null,
  endDate = null,
  page = 1,
  limit = 20,
}) => {
  if (!mongoose.Types.ObjectId.isValid(ownerId)) {
    const error = new Error("Invalid owner");
    error.status = 400;
    throw error;
  }

  const normalizedStoreId =
    storeId && mongoose.Types.ObjectId.isValid(storeId) ? new mongoose.Types.ObjectId(storeId) : null;

  if (normalizedStoreId) {
    const owns = await StoreModel.exists({ _id: normalizedStoreId, owner: ownerId, isDeleted: { $ne: true } });
    if (!owns) {
      const error = new Error("You are not authorized to view subscribers for this store");
      error.status = 403;
      throw error;
    }
  }

  const match = {
    storeOwner: new mongoose.Types.ObjectId(ownerId),
    isDeleted: { $ne: true },
  };

  if (normalizedStoreId) {
    match.store = normalizedStoreId;
  }

  if (status && status !== "all") {
    match.status = status;
  }

  if (source && source !== "all") {
    match.source = source;
  }

  const from = parseDate(startDate);
  const to = parseDate(endDate);
  if (from || to) {
    match.subscribedAt = {};
    if (from) match.subscribedAt.$gte = from;
    if (to) match.subscribedAt.$lte = to;
  }

  const trimmedSearch = normalizeString(search);
  if (trimmedSearch) {
    const regex = new RegExp(escapeRegex(trimmedSearch), "i");
    match.$or = [{ email: regex }, { referrer: regex }];
  }

  const safePage = parsePage(page, 1);
  const safeLimit = parseLimit(limit, 20, 200);
  const skip = (safePage - 1) * safeLimit;

  const [items, total, storeOptions] = await Promise.all([
    StoreSubscriberModel.find(match)
      .sort({ subscribedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("store", "name storeLink logo owner")
      .lean(),
    StoreSubscriberModel.countDocuments(match),
    StoreModel.find({ owner: ownerId, isDeleted: { $ne: true } })
      .select("_id name storeLink logo")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  return {
    subscribers: items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
    filters: {
      stores: storeOptions,
    },
  };
};

export const listAdminSubscribers = async ({
  storeId = null,
  ownerId = null,
  search = "",
  status = "all",
  source = "all",
  startDate = null,
  endDate = null,
  page = 1,
  limit = 20,
}) => {
  const match = { isDeleted: { $ne: true } };

  if (storeId) {
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      const error = new Error("Invalid store id");
      error.status = 400;
      throw error;
    }
    match.store = new mongoose.Types.ObjectId(storeId);
  }

  if (ownerId) {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      const error = new Error("Invalid owner id");
      error.status = 400;
      throw error;
    }
    match.storeOwner = new mongoose.Types.ObjectId(ownerId);
  }

  if (status && status !== "all") {
    match.status = status;
  }

  if (source && source !== "all") {
    match.source = source;
  }

  const from = parseDate(startDate);
  const to = parseDate(endDate);
  if (from || to) {
    match.subscribedAt = {};
    if (from) match.subscribedAt.$gte = from;
    if (to) match.subscribedAt.$lte = to;
  }

  const trimmedSearch = normalizeString(search);
  if (trimmedSearch) {
    const regex = new RegExp(escapeRegex(trimmedSearch), "i");
    match.$or = [{ email: regex }, { referrer: regex }];
  }

  const safePage = parsePage(page, 1);
  const safeLimit = parseLimit(limit, 20, 200);
  const skip = (safePage - 1) * safeLimit;

  const [items, total, storeOptions] = await Promise.all([
    StoreSubscriberModel.find(match)
      .sort({ subscribedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("store", "name storeLink logo owner")
      .populate("storeOwner", "displayName username email")
      .lean(),
    StoreSubscriberModel.countDocuments(match),
    StoreModel.find({ isDeleted: { $ne: true } })
      .select("_id name storeLink logo owner")
      .sort({ createdAt: -1 })
      .limit(250)
      .lean(),
  ]);

  return {
    subscribers: items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
    filters: {
      stores: storeOptions,
    },
  };
};

export const deleteAdminSubscriber = async ({
  subscriberId,
  adminId,
  reason = "admin_delete",
}) => {
  if (!mongoose.Types.ObjectId.isValid(subscriberId)) {
    const error = new Error("Invalid subscriber id");
    error.status = 400;
    throw error;
  }

  const existing = await StoreSubscriberModel.findById(subscriberId)
    .select("_id isDeleted")
    .lean();

  if (!existing?._id) {
    const error = new Error("Subscriber not found");
    error.status = 404;
    throw error;
  }

  if (existing.isDeleted) {
    return { deleted: false, alreadyDeleted: true };
  }

  await StoreSubscriberModel.updateOne(
    { _id: existing._id },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: adminId && mongoose.Types.ObjectId.isValid(adminId)
          ? new mongoose.Types.ObjectId(adminId)
          : null,
        deleteReason: clampString(reason, 200),
      },
    }
  );

  return { deleted: true };
};
