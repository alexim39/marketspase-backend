// src/apps/campaign/services/payout-tier.service.js

export function getPayoutForViews(views, policy = 'default') {
  const v = Number(views);

  if (!Number.isFinite(v) || v < 35) return 0;

  if (v >= 601) return 700;
  if (v >= 451) return 600;
  if (v >= 311) return 500;
  if (v >= 151) return 400;
  if (v >= 102) return 300;
  if (v >= 66)  return 200;

  return 100; // 35–65
}

// Default tier snapshot mapping for campaigns (range => payout)
export const DEFAULT_TIER_SNAPSHOT = {
  '35-65': 100,
  '66-101': 200,
  '102-150': 300,
  '151-310': 400,
  '311-450': 500,
  '451-600': 600,
  '601+': 700,
};
