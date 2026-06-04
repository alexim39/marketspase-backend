import { getCampaignPpcPricingConfig } from './campaign-ppc-pricing-config.service.js';

const FALLBACK_COST_PER_CLICK = 80;

const normalizePositiveNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
};

export const DEFAULT_CAMPAIGN_COST_PER_CLICK = normalizePositiveNumber(
  process.env.DEFAULT_CAMPAIGN_COST_PER_CLICK
) ?? FALLBACK_COST_PER_CLICK;

export const resolveCampaignCostPerClick = (...sources) => {
  for (const source of sources) {
    const normalized = normalizePositiveNumber(source);
    if (normalized !== null) {
      return normalized;
    }
  }

  return DEFAULT_CAMPAIGN_COST_PER_CLICK;
};

export const resolveConfiguredCampaignCostPerClick = async (...sources) => {
  const config = await getCampaignPpcPricingConfig();

  if (!config.enabled) {
    return resolveCampaignCostPerClick(...sources);
  }

  if (config.allowMarketerOverride) {
    for (const source of sources) {
      const normalized = normalizePositiveNumber(source);
      if (
        normalized !== null &&
        normalized >= config.minCostPerClick &&
        normalized <= config.maxCostPerClick
      ) {
        return normalized;
      }
    }
  }

  return config.defaultCostPerClick || resolveCampaignCostPerClick(...sources);
};

export const hasValidCampaignCostPerClick = (value) =>
  normalizePositiveNumber(value) !== null;
