import mongoose from "mongoose";
import { StoreModel } from "../../models/store/index.js";
import {
  resolveAnalyticsRange,
  getStorefrontAnalyticsOverview,
  searchStorefrontAnalyticsProducts,
  getStorefrontProductCategories,
  getStorefrontProductPromoterBreakdown,
  getStorefrontPromoterProductBreakdown,
} from "../../services/admin/storefront-analytics.service.js";

const DEFAULT_TIMEZONE = "Africa/Lagos";

const toInt = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
};

const clampLimit = (value, fallback = 10, max = 50) => {
  const n = toInt(value, fallback);
  return Math.min(max, Math.max(1, n));
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeTimezone = (value) => {
  const tz = String(value || "").trim();
  // Basic sanity guard. We keep it permissive (IANA tz names contain /, -, _).
  if (!tz) return DEFAULT_TIMEZONE;
  if (!/^[A-Za-z0-9_+./-]+$/.test(tz)) return DEFAULT_TIMEZONE;
  return tz;
};

const safeObjectId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  return raw;
};

export const getStorefrontAnalyticsOverviewHandler = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      range,
      rangeDays,
      storeId,
      category,
      productId,
      promoterId,
      buyerCountry,
      buyerState,
      timezone,
      topLimit,
    } = req.query;

    const { start, end } = resolveAnalyticsRange({
      startDate,
      endDate,
      rangeDays: rangeDays ?? range,
      now: new Date(),
    });

    const data = await getStorefrontAnalyticsOverview({
      start,
      end,
      storeId: safeObjectId(storeId),
      category: category ? String(category).trim() : null,
      productId: safeObjectId(productId),
      promoterId: safeObjectId(promoterId),
      buyerCountry: buyerCountry ? String(buyerCountry).trim() : null,
      buyerState: buyerState ? String(buyerState).trim() : null,
      timezone: safeTimezone(timezone),
      topLimit: clampLimit(topLimit, 10, 50),
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error?.message || "Failed to load storefront analytics.";
    console.error("Storefront analytics overview error:", error);
    return res.status(status).json({
      success: false,
      message,
    });
  }
};

export const searchStorefrontAnalyticsProductsHandler = async (req, res) => {
  try {
    const { query, storeId, category, limit } = req.query;
    const data = await searchStorefrontAnalyticsProducts({
      search: query,
      storeId: safeObjectId(storeId),
      category: category ? String(category).trim() : null,
      limit: clampLimit(limit, 20, 50),
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error?.message || "Failed to search products.";
    console.error("Storefront analytics product search error:", error);
    return res.status(status).json({
      success: false,
      message,
    });
  }
};

export const getStorefrontAnalyticsCategoriesHandler = async (_req, res) => {
  try {
    const data = await getStorefrontProductCategories();
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Storefront analytics category list error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load product categories.",
    });
  }
};

export const getStorefrontProductPromoterBreakdownHandler = async (req, res) => {
  try {
    const { startDate, endDate, range, rangeDays, storeId, productId, buyerCountry, buyerState, limit } = req.query;

    const { start, end } = resolveAnalyticsRange({
      startDate,
      endDate,
      rangeDays: rangeDays ?? range,
      now: new Date(),
    });

    const data = await getStorefrontProductPromoterBreakdown({
      start,
      end,
      storeId: safeObjectId(storeId),
      productId: safeObjectId(productId),
      buyerCountry: buyerCountry ? String(buyerCountry).trim() : null,
      buyerState: buyerState ? String(buyerState).trim() : null,
      limit: clampLimit(limit, 100, 250),
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error?.message || "Failed to load product promoter breakdown.";
    console.error("Storefront analytics product-promoter breakdown error:", error);
    return res.status(status).json({ success: false, message });
  }
};

export const getStorefrontPromoterProductBreakdownHandler = async (req, res) => {
  try {
    const { startDate, endDate, range, rangeDays, storeId, promoterId, buyerCountry, buyerState, limit } = req.query;

    const { start, end } = resolveAnalyticsRange({
      startDate,
      endDate,
      rangeDays: rangeDays ?? range,
      now: new Date(),
    });

    const data = await getStorefrontPromoterProductBreakdown({
      start,
      end,
      storeId: safeObjectId(storeId),
      promoterId: safeObjectId(promoterId),
      buyerCountry: buyerCountry ? String(buyerCountry).trim() : null,
      buyerState: buyerState ? String(buyerState).trim() : null,
      limit: clampLimit(limit, 100, 250),
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error?.message || "Failed to load promoter product breakdown.";
    console.error("Storefront analytics promoter-product breakdown error:", error);
    return res.status(status).json({ success: false, message });
  }
};

// Lightweight store options endpoint for analytics filters (avoid heavy populates).
export const searchStorefrontAnalyticsStoresHandler = async (req, res) => {
  try {
    const { query, limit } = req.query;
    const q = String(query || "").trim();
    const lim = clampLimit(limit, 20, 50);

    const filter = { isDeleted: { $ne: true } };
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: regex }, { storeLink: regex }];
    }

    const stores = await StoreModel.find(filter)
      .select("_id name storeLink logo owner isVerified isActive verificationTier category")
      .sort({ name: 1 })
      .limit(lim)
      .lean();

    return res.status(200).json({
      success: true,
      data: (stores || []).map((s) => ({
        _id: s._id,
        name: s.name,
        storeLink: s.storeLink,
        logo: s.logo,
        owner: s.owner,
        category: s.category,
        isVerified: Boolean(s.isVerified),
        isActive: s.isActive !== false,
        verificationTier: s.verificationTier || "basic",
      })),
    });
  } catch (error) {
    console.error("Storefront analytics store options error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load store options.",
    });
  }
};
