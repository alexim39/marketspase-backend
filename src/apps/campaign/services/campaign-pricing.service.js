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

export const hasValidCampaignCostPerClick = (value) =>
  normalizePositiveNumber(value) !== null;
