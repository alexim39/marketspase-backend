import { CampaignPpcConfigModel } from '../models/campaign-ppc-config.model.js';

const DEFAULT_KEY = 'default';
const FALLBACK_COST_PER_CLICK = 80;
const FALLBACK_MIN_COST_PER_CLICK = 20;
const FALLBACK_MAX_COST_PER_CLICK = 500;
const CONFIG_CACHE_TTL_MS = Math.max(Number(process.env.PPC_PRICING_CONFIG_CACHE_TTL_MS || 30000), 0);

let cachedConfig = null;
let cachedAt = 0;

const normalizePositiveNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

const roundCurrencyAmount = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const clearConfigCache = () => {
  cachedConfig = null;
  cachedAt = 0;
};

export const getOrCreateCampaignPpcConfig = async () => {
  let config = await CampaignPpcConfigModel.findOne({ key: DEFAULT_KEY });
  if (!config) {
    config = await CampaignPpcConfigModel.create({ key: DEFAULT_KEY });
  }
  return config;
};

export const serializeCampaignPpcConfig = (config) => {
  const item = config?.toObject ? config.toObject() : config || {};
  const rawMin = normalizePositiveNumber(item.minCostPerClick) ?? FALLBACK_MIN_COST_PER_CLICK;
  const rawMax = normalizePositiveNumber(item.maxCostPerClick) ?? FALLBACK_MAX_COST_PER_CLICK;
  const minCostPerClick = roundCurrencyAmount(Math.min(rawMin, rawMax));
  const maxCostPerClick = roundCurrencyAmount(Math.max(rawMin, rawMax));
  const defaultCostPerClick = roundCurrencyAmount(
    clampNumber(
      normalizePositiveNumber(item.defaultCostPerClick) ?? FALLBACK_COST_PER_CLICK,
      minCostPerClick,
      maxCostPerClick,
    ),
  );

  return {
    ...item,
    key: item.key || DEFAULT_KEY,
    enabled: item.enabled !== false,
    currency: String(item.currency || 'NGN').trim().toUpperCase(),
    defaultCostPerClick,
    minCostPerClick,
    maxCostPerClick,
    allowMarketerOverride: Boolean(item.allowMarketerOverride),
    changeReason: String(item.changeReason || ''),
  };
};

export const getCampaignPpcPricingConfig = async ({ useCache = true } = {}) => {
  if (useCache && CONFIG_CACHE_TTL_MS && cachedConfig && Date.now() - cachedAt < CONFIG_CACHE_TTL_MS) {
    return cachedConfig;
  }

  const config = serializeCampaignPpcConfig(await getOrCreateCampaignPpcConfig());
  cachedConfig = config;
  cachedAt = Date.now();
  return config;
};

export const getPublicCampaignPpcPricingConfig = async () => {
  const config = await getCampaignPpcPricingConfig();
  return {
    enabled: config.enabled,
    currency: config.currency,
    defaultCostPerClick: config.defaultCostPerClick,
    minCostPerClick: config.minCostPerClick,
    maxCostPerClick: config.maxCostPerClick,
    allowMarketerOverride: config.allowMarketerOverride,
    updatedAt: config.updatedAt || null,
  };
};

export const updateCampaignPpcPricingConfig = async (payload = {}, adminUserId = null) => {
  const config = await getOrCreateCampaignPpcConfig();
  const current = serializeCampaignPpcConfig(config);

  const nextMin = normalizePositiveNumber(payload.minCostPerClick) ?? current.minCostPerClick;
  const nextMax = normalizePositiveNumber(payload.maxCostPerClick) ?? current.maxCostPerClick;
  const minCostPerClick = roundCurrencyAmount(Math.min(nextMin, nextMax));
  const maxCostPerClick = roundCurrencyAmount(Math.max(nextMin, nextMax));
  const defaultCostPerClick = roundCurrencyAmount(
    clampNumber(
      normalizePositiveNumber(payload.defaultCostPerClick) ?? current.defaultCostPerClick,
      minCostPerClick,
      maxCostPerClick,
    ),
  );

  config.enabled = payload.enabled !== undefined ? Boolean(payload.enabled) : current.enabled;
  config.currency = String(payload.currency || current.currency || 'NGN').trim().toUpperCase();
  config.defaultCostPerClick = defaultCostPerClick;
  config.minCostPerClick = minCostPerClick;
  config.maxCostPerClick = maxCostPerClick;
  config.allowMarketerOverride = Boolean(payload.allowMarketerOverride);
  config.changeReason = String(payload.changeReason || '').trim().slice(0, 500);

  if (adminUserId) {
    config.updatedBy = adminUserId;
  }

  await config.save();
  clearConfigCache();
  return serializeCampaignPpcConfig(config);
};
