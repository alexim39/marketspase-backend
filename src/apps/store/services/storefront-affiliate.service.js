import crypto from "crypto";

const DEFAULT_COMMISSION_RATE = 10;
const DEFAULT_COOKIE_WINDOW_DAYS = 30;

export const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

export const roundMoney = (value) => Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;

export const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  return Boolean(value);
};

export const normalizeCommissionType = (value) => {
  return value === "fixed" ? "fixed" : "percentage";
};

export const getProductAffiliateSettings = (product = {}) => {
  const affiliate = product.affiliate || {};
  const legacyRate = product.commissionRate;
  const legacyType = product.commissionType;
  const legacyFixed = product.fixedCommission;

  const commissionType = normalizeCommissionType(affiliate.commissionType || legacyType);
  const commissionRate = Math.min(
    100,
    Math.max(0, toNumber(affiliate.commissionRate ?? legacyRate, DEFAULT_COMMISSION_RATE))
  );
  const fixedCommission = Math.max(0, toNumber(affiliate.fixedCommission ?? legacyFixed, 0));
  const cookieWindowDays = Math.max(
    1,
    toNumber(affiliate.cookieWindowDays, DEFAULT_COOKIE_WINDOW_DAYS)
  );

  return {
    enabled: toBoolean(affiliate.enabled, true),
    commissionType,
    commissionRate,
    fixedCommission,
    cookieWindowDays,
    autoApprovePromoters: toBoolean(affiliate.autoApprovePromoters, true),
  };
};

export const getBodyValue = (body = {}, ...keys) => {
  for (const key of keys) {
    if (body[key] !== undefined) return body[key];

    const bracketMatch = key.match(/^([^\[]+)\[([^\]]+)\]$/);
    if (bracketMatch && body[bracketMatch[1]]?.[bracketMatch[2]] !== undefined) {
      return body[bracketMatch[1]][bracketMatch[2]];
    }

    const dotParts = key.split(".");
    if (dotParts.length > 1) {
      let current = body;
      for (const part of dotParts) {
        current = current?.[part];
      }
      if (current !== undefined) return current;
    }
  }

  return undefined;
};

export const extractAffiliateSettingsFromBody = (body = {}, fallback = {}) => {
  const existing = getProductAffiliateSettings(fallback);
  const commissionType = normalizeCommissionType(
    getBodyValue(body, "affiliate.commissionType", "affiliate[commissionType]", "commissionType") ?? existing.commissionType
  );

  return {
    enabled: toBoolean(
      getBodyValue(body, "affiliate.enabled", "affiliate[enabled]", "affiliateEnabled"),
      existing.enabled
    ),
    commissionType,
    commissionRate: Math.min(
      100,
      Math.max(
        0,
        toNumber(
          getBodyValue(body, "affiliate.commissionRate", "affiliate[commissionRate]", "commissionRate"),
          existing.commissionRate
        )
      )
    ),
    fixedCommission: Math.max(
      0,
      toNumber(
        getBodyValue(body, "affiliate.fixedCommission", "affiliate[fixedCommission]", "fixedCommission"),
        existing.fixedCommission
      )
    ),
    cookieWindowDays: Math.max(
      1,
      toNumber(
        getBodyValue(body, "affiliate.cookieWindowDays", "affiliate[cookieWindowDays]", "cookieWindowDays"),
        existing.cookieWindowDays
      )
    ),
    autoApprovePromoters: toBoolean(
      getBodyValue(body, "affiliate.autoApprovePromoters", "affiliate[autoApprovePromoters]", "autoApprovePromoters"),
      existing.autoApprovePromoters
    ),
  };
};

export const calculateCommissionForAmount = (amount, settings = {}) => {
  const saleAmount = Math.max(0, toNumber(amount, 0));
  const commissionType = normalizeCommissionType(settings.commissionType);
  const commission = commissionType === "fixed"
    ? Math.min(saleAmount, Math.max(0, toNumber(settings.fixedCommission, 0)))
    : (saleAmount * Math.min(100, Math.max(0, toNumber(settings.commissionRate, DEFAULT_COMMISSION_RATE)))) / 100;

  return roundMoney(Math.min(saleAmount, commission));
};

const DEFAULT_FRONTEND_URL = "https://marketspase.com";

export const getFrontendBaseUrl = () => {
  // In production, redirecting users to localhost breaks affiliate links.
  // Prefer explicit configuration, otherwise fall back to the public web app.
  return (process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL).replace(/\/+$/, "");
};

export const getRequestBaseUrl = (req) => {
  const configured = process.env.STORE_AFFILIATE_TRACKING_BASE_URL || process.env.API_PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host")}`.replace(/\/+$/, "");
};

export const buildAffiliateUrl = (req, uniqueCode) => {
  // Public affiliate/tracking links should hit the API (not the SPA),
  // so the click is recorded server-side and we can safely 302 redirect
  // to the product landing page.
  return `${getRequestBaseUrl(req)}/api/v1/stores/product/promotions/track-click/${encodeURIComponent(uniqueCode)}`;
};

export const buildProductLandingUrl = ({ productId, uniqueCode, uniqueId, promoterId, clicked = true }) => {
  const params = new URLSearchParams();
  if (uniqueCode) params.set("track", uniqueCode);
  if (uniqueId) params.set("ref", uniqueId);
  if (promoterId) params.set("promoter", promoterId.toString());
  if (clicked) params.set("clicked", "1");

  const query = params.toString();
  return `${getFrontendBaseUrl()}/promote/${productId}${query ? `?${query}` : ""}`;
};

export const detectDeviceType = (userAgent = "") => {
  const ua = userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
};

export const hashIp = (ip = "") => {
  if (!ip) return "";
  return crypto.createHash("sha256").update(ip).digest("hex");
};

export const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "";
};

export const upsertReferralSource = (sources = [], source = "direct") => {
  const normalizedSource = source || "direct";
  const existing = sources.find((item) => item.source === normalizedSource);
  if (existing) {
    existing.count += 1;
    return sources;
  }

  sources.push({ source: normalizedSource, count: 1 });
  return sources;
};
