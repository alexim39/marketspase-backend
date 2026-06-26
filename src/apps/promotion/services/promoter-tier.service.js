// Promoter tier computation based on performance metrics
import { UserModel } from '../../user/models/user/index.js';
import { LandingEventModel } from '../../campaign/models/landing-event.model.js';
import { PromotionModel } from '../../promotion/models/index.js';

const TIER_THRESHOLDS = {
  gold: { minClicks: 500, minConversionRate: 0.03, minEarnings: 50000 },
  silver: { minClicks: 100, minConversionRate: 0.015, minEarnings: 10000 },
  bronze: { minClicks: 10, minConversionRate: 0.005, minEarnings: 1000 },
};

const TIER_BENEFITS = {
  gold: { label: 'Gold', icon: 'workspace_premium', earlyAccess: true, prioritySupport: true, commissionBonus: 0.05 },
  silver: { label: 'Silver', icon: 'military_tech', earlyAccess: false, prioritySupport: true, commissionBonus: 0.02 },
  bronze: { label: 'Bronze', icon: 'shield', earlyAccess: false, prioritySupport: false, commissionBonus: 0 },
};

export async function computePromoterTier(promoterId) {
  const [stats] = await LandingEventModel.aggregate([
    { $match: { promoter: promoterId } },
    { $group: {
      _id: null,
      totalClicks: { $sum: { $cond: [{ $eq: ['$event', 'landing_view'] }, 1, 0] } },
      totalLeads: { $sum: { $cond: [{ $eq: ['$event', 'lead_success'] }, 1, 0] } },
    }},
  ]);

  const clicks = stats?.totalClicks || 0;
  const leads = stats?.totalLeads || 0;
  const conversionRate = clicks > 0 ? leads / clicks : 0;

  const [earnings] = await PromotionModel.aggregate([
    { $match: { promoter: promoterId, status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$payout' } } },
  ]);
  const totalEarnings = earnings?.total || 0;

  if (clicks >= TIER_THRESHOLDS.gold.minClicks && conversionRate >= TIER_THRESHOLDS.gold.minConversionRate && totalEarnings >= TIER_THRESHOLDS.gold.minEarnings) return 'gold';
  if (clicks >= TIER_THRESHOLDS.silver.minClicks && conversionRate >= TIER_THRESHOLDS.silver.minConversionRate && totalEarnings >= TIER_THRESHOLDS.silver.minEarnings) return 'silver';
  if (clicks >= TIER_THRESHOLDS.bronze.minClicks && conversionRate >= TIER_THRESHOLDS.bronze.minConversionRate && totalEarnings >= TIER_THRESHOLDS.bronze.minEarnings) return 'bronze';
  return 'unranked';
}

export async function updatePromoterTier(promoterId) {
  try {
    const tier = await computePromoterTier(promoterId);
    await UserModel.updateOne({ _id: promoterId }, { $set: { promoterTier: tier } });
    return { tier, ...TIER_BENEFITS[tier] || { label: 'Unranked', icon: 'person' } };
  } catch (e) {
    console.error('Promoter tier update failed:', e.message);
    return null;
  }
}
