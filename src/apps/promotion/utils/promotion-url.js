export const DEFAULT_PROMOTION_TRACKING_PATH = "/api/v1/campaign/track";

const LEGACY_PROMOTION_TRACKING_PATH = "/campaign/track";

const stripTrailingSlashes = (value) => String(value || "").replace(/\/+$/, "");

const normalizeBaseUrl = (value) => stripTrailingSlashes(value).replace(/\/api\/v1$/i, "");

export const getPromotionTrackingBaseUrl = () => {
  const configuredBaseUrl =
    process.env.PROMOTION_TRACKING_BASE_URL ||
    process.env.API_URL ||
    process.env.BACKEND_URL;

  return configuredBaseUrl ? normalizeBaseUrl(configuredBaseUrl) : "";
};

export const normalizePromotionTrackingPath = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return DEFAULT_PROMOTION_TRACKING_PATH;
  }

  if (/^https?:\/\//i.test(rawValue)) {
    const parsedUrl = new URL(rawValue);
    return normalizePromotionTrackingPath(parsedUrl.pathname);
  }

  const normalizedPath = `/${rawValue.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  if (normalizedPath === LEGACY_PROMOTION_TRACKING_PATH) {
    return DEFAULT_PROMOTION_TRACKING_PATH;
  }

  if (normalizedPath.startsWith("/campaign/")) {
    return `/api/v1${normalizedPath}`;
  }

  return normalizedPath;
};

const extractUpiFromPath = (pathname, providedUpi = "") => {
  const normalizedPath = String(pathname || "").trim();
  const pathMatch = normalizedPath.match(/^\/(?:api\/v1\/)?campaign\/track\/([^/?#]+)/i);

  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  const fallbackUpi = String(providedUpi || "").trim();
  if (!fallbackUpi) {
    return "";
  }

  const normalizedTrackingPath = normalizePromotionTrackingPath(DEFAULT_PROMOTION_TRACKING_PATH);
  const normalizedCandidatePath = normalizePromotionTrackingPath(normalizedPath);

  return normalizedCandidatePath === normalizedTrackingPath ? fallbackUpi : "";
};

export const buildPromotionTrackingUrl = ({
  baseUrl,
  upi,
  trackingPath = DEFAULT_PROMOTION_TRACKING_PATH,
} = {}) => {
  const normalizedUpi = String(upi || "").trim();
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (!normalizedBaseUrl || !normalizedUpi) {
    return "";
  }

  return `${normalizedBaseUrl}${normalizePromotionTrackingPath(trackingPath)}/${normalizedUpi}`;
};

export const normalizePromotionUrl = (value, {
  upi,
  baseUrl = "",
  trackingPath = DEFAULT_PROMOTION_TRACKING_PATH,
} = {}) => {
  const rawValue = String(value || "").trim();
  const normalizedTrackingPath = normalizePromotionTrackingPath(trackingPath);
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl || getPromotionTrackingBaseUrl());

  if (!rawValue) {
    return buildPromotionTrackingUrl({
      baseUrl: normalizedBaseUrl,
      upi,
      trackingPath: normalizedTrackingPath,
    });
  }

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      const parsedUrl = new URL(rawValue);
      const normalizedUpi = extractUpiFromPath(parsedUrl.pathname, upi);
      if (!normalizedUpi) {
        return rawValue;
      }

      const canonicalUrl = buildPromotionTrackingUrl({
        baseUrl: normalizedBaseUrl || parsedUrl.origin,
        upi: normalizedUpi,
        trackingPath: normalizedTrackingPath,
      });

      return `${canonicalUrl}${parsedUrl.search}${parsedUrl.hash}`;
    } catch {
      return rawValue;
    }
  }

  const normalizedUpi = extractUpiFromPath(rawValue, upi);
  if (!normalizedUpi || !normalizedBaseUrl) {
    return rawValue;
  }

  return buildPromotionTrackingUrl({
    baseUrl: normalizedBaseUrl,
    upi: normalizedUpi,
    trackingPath: normalizedTrackingPath,
  });
};

export const normalizePromotionTrackingFields = (promotion, options = {}) => {
  if (!promotion || typeof promotion !== "object") {
    return promotion;
  }

  const normalizedPromotionUrl = normalizePromotionUrl(promotion.promotionUrl, {
    upi: promotion.upi,
    ...options,
  });

  return {
    ...promotion,
    promotionUrl: normalizedPromotionUrl || promotion.promotionUrl || null,
  };
};
