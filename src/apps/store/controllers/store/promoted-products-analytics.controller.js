import mongoose from "mongoose";
import { UserModel } from "../../../user/models/user/index.js";
import { ProductModel } from "../../models/promotion/index.js";
import { StoreModel } from "../../models/store/index.js";
import {
  getMarketerProductPromoterBreakdown,
  getMarketerPromotedProductsOverview,
} from "../../services/marketer/promoted-products-analytics.service.js";

const toInt = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
};

const clampLimit = (value, fallback = 20, max = 100) => {
  const n = toInt(value, fallback);
  return Math.min(max, Math.max(1, n));
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeObjectId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  return raw;
};

export const getMarketerPromotedProductsAnalyticsOverviewHandler = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      rangeDays,
      storeId,
      category,
      productId,
      promoterId,
      search,
      page,
      limit,
      topLimit,
      timezone,
    } = req.query;

    const data = await getMarketerPromotedProductsOverview({
      actorUserId: req.userId || req.user?._id,
      actorUid: req.user?.uid,
      role: req.user?.role,
      startDate,
      endDate,
      rangeDays,
      storeId: safeObjectId(storeId),
      category: category ? String(category).trim() : null,
      productId: safeObjectId(productId),
      promoterId: safeObjectId(promoterId),
      search: search ? String(search).trim() : null,
      page: toInt(page, 1),
      limit: clampLimit(limit, 20, 100),
      topLimit: clampLimit(topLimit, 10, 50),
      timezone,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error?.message || "Failed to load promoted products analytics.";
    console.error("Marketer promoted products analytics overview error:", error);
    return res.status(status).json({ success: false, message });
  }
};

export const getMarketerProductPromoterBreakdownHandler = async (req, res) => {
  try {
    const { productId, startDate, endDate, rangeDays, storeId, timezone, limit } = req.query;
    const data = await getMarketerProductPromoterBreakdown({
      actorUserId: req.userId || req.user?._id,
      actorUid: req.user?.uid,
      role: req.user?.role,
      productId: safeObjectId(productId),
      startDate,
      endDate,
      rangeDays,
      storeId: safeObjectId(storeId),
      timezone,
      limit: clampLimit(limit, 100, 250),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error?.message || "Failed to load product promoter breakdown.";
    console.error("Marketer product-promoter breakdown error:", error);
    return res.status(status).json({ success: false, message });
  }
};

// Optional filter helpers for the UI (promoter/product autocomplete).
export const searchMarketerPromotedProductsProductOptionsHandler = async (req, res) => {
  try {
    if (req.user?.role !== "marketer" && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only marketers can access this resource." });
    }

    const q = String(req.query.query || "").trim();
    const lim = clampLimit(req.query.limit, 20, 50);
    const storeId = safeObjectId(req.query.storeId);
    const category = String(req.query.category || "").trim();

    // Resolve stores owned by actor (avoid owner=uid string because Store.owner is ObjectId).
    const ors = [];
    const uid = String(req.user?.uid || "").trim();
    const actorId = String(req.userId || req.user?._id || "").trim();
    if (mongoose.Types.ObjectId.isValid(actorId)) ors.push({ owner: new mongoose.Types.ObjectId(actorId) });
    if (uid) {
      const users = await UserModel.find({ uid }).select("_id").lean();
      const ids = (users || []).map((u) => u?._id).filter(Boolean);
      if (ids.length) ors.push({ owner: { $in: ids } });
    }

    const storeFilter = { isDeleted: { $ne: true }, $or: ors };
    if (!ors.length && !uid) return res.status(200).json({ success: true, data: [] });

    const storeIds = new Set();

    if (ors.length) {
      if (storeId) storeFilter._id = new mongoose.Types.ObjectId(storeId);
      const stores = await StoreModel.find(storeFilter).select("_id").lean();
      for (const s of stores || []) {
        if (s?._id) storeIds.add(String(s._id));
      }
    }

    // Legacy stores where owner is stored as Firebase UID string.
    if (uid) {
      const cursor = StoreModel.collection.find(
        { owner: uid, isDeleted: { $ne: true } },
        { projection: { _id: 1 } }
      );
      const legacyIds = (await cursor.toArray()).map((row) => row?._id).filter(Boolean);
      for (const id of legacyIds) {
        const sid = String(id);
        if (storeId && sid !== String(storeId)) continue;
        storeIds.add(sid);
      }
    }

    const storeIdList = Array.from(storeIds).map((id) => new mongoose.Types.ObjectId(id));
    if (!storeIdList.length) return res.status(200).json({ success: true, data: [] });

    const productQuery = {
      isDeleted: { $ne: true },
      store: { $in: storeIdList },
    };
    if (category) productQuery.category = category;
    if (q) productQuery.name = new RegExp(escapeRegex(q), "i");

    const products = await ProductModel.find(productQuery)
      .select("_id name category price currency images slug store")
      .sort({ name: 1 })
      .limit(lim)
      .lean();

    return res.status(200).json({
      success: true,
      data: (products || []).map((p) => ({
        _id: p._id,
        name: p.name,
        category: p.category,
        price: p.price,
        currency: p.currency,
        image: p.images?.[0]?.url || null,
        slug: p.slug,
        store: p.store,
      })),
    });
  } catch (error) {
    console.error("Marketer promoted products product options error:", error);
    return res.status(500).json({ success: false, message: "Failed to load product options." });
  }
};

export const searchMarketerPromotedProductsPromoterOptionsHandler = async (req, res) => {
  try {
    if (req.user?.role !== "marketer" && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only marketers can access this resource." });
    }

    const q = String(req.query.query || "").trim();
    const lim = clampLimit(req.query.limit, 20, 50);

    // For now we allow search across promoters; the overview endpoint still enforces store ownership for analytics.
    // If we want to be stricter, we can restrict to promoters who have promoted the actor's storeIds.
    const filter = { role: "promoter" };
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ displayName: regex }, { username: regex }, { email: regex }];
    }

    const users = await UserModel.find(filter)
      .select("_id displayName username email avatar role")
      .sort({ displayName: 1 })
      .limit(lim)
      .lean();

    return res.status(200).json({
      success: true,
      data: (users || []).map((u) => ({
        _id: u._id,
        displayName: u.displayName,
        username: u.username,
        email: u.email,
        avatar: u.avatar,
      })),
    });
  } catch (error) {
    console.error("Marketer promoted products promoter options error:", error);
    return res.status(500).json({ success: false, message: "Failed to load promoter options." });
  }
};
