import { CampaignModel } from '../models/campaign.model.js';
import { CampaignClickModel } from '../models/campaign-click.model.js';
import { UserModel } from '../../user/models/user/index.js';
import { NotificationService } from '../../notification/services/notification.service.js';

const PROMOTER_NOTIFICATION_TITLE = 'New Campaign Match';
const SCORE_CAP = 100;

async function getTopPromotersByCategory(category, limit = 15) {
  const match = { 'promotions.status': 'billable' };
  if (category) {
    try {
      const campaigns = await CampaignModel.find({ category: new RegExp(category, 'i'), isDeleted: false })
        .select('_id').lean();
      const campaignIds = campaigns.map(c => c._id);
      if (campaignIds.length) match.campaign = { $in: campaignIds };
    } catch (e) { /* continue without category filter */ }
  }

  const promoters = await CampaignClickModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$promoter',
        totalClicks: { $sum: 1 },
        totalBillable: { $sum: { $cond: [{ $eq: ['$status', 'billable'] }, 1, 0] } },
        uniqueCampaigns: { $addToSet: '$campaign' },
      },
    },
    { $addFields: { uniqueCount: { $size: '$uniqueCampaigns' } } },
    { $match: { totalClicks: { $gte: 5 } } },
    { $sort: { totalClicks: -1, totalBillable: -1 } },
    { $limit: limit },
  ]);

  return promoters;
}

async function getPromoterProfiles(promoterIds) {
  return UserModel.find({ _id: { $in: promoterIds }, role: 'promoter', isActive: true })
    .select('displayName avatar promoterTier fraudProfile.trustScore collaborationRating')
    .lean();
}

function computeScore(clickStats, profile) {
  const clickScore = Math.min((clickStats.totalClicks || 0) / 50, 1) * 40;
  const uniqueScore = Math.min((clickStats.uniqueCount || 0) / 5, 1) * 20;
  const trustScore = ((profile.fraudProfile?.trustScore ?? 100) / 100) * 25;
  const tierMap = { gold: 15, silver: 10, bronze: 5, unranked: 0 };
  const tierScore = tierMap[profile.promoterTier] || 0;

  return Math.round(clickScore + uniqueScore + trustScore + tierScore);
}

export async function triggerAiPromoterMatchmaking(campaign) {
  try {
    const topPromoters = await getTopPromotersByCategory(campaign.category);
    if (!topPromoters.length) return;

    const profiles = await getPromoterProfiles(topPromoters.map(p => p._id));
    const profileMap = new Map(profiles.map(p => [p._id.toString(), p]));

    const suggested = topPromoters
      .map(p => {
        const profile = profileMap.get(p._id.toString());
        if (!profile) return null;
        const score = computeScore(p, profile);
        return {
          promoterId: p._id,
          promoterName: profile.displayName || 'Promoter',
          avatar: profile.avatar || '',
          score,
          tier: profile.promoterTier || 'unranked',
          trustScore: profile.fraudProfile?.trustScore ?? 100,
          clicks: p.totalClicks,
          uniqueCampaigns: p.uniqueCount,
          reason: `${p.totalClicks} clicks across ${p.uniqueCount} campaigns — ${profile.promoterTier || 'new'} tier`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (suggested.length) {
      await CampaignModel.updateOne(
        { _id: campaign._id },
        { $set: { aiSuggestedPromoters: suggested } }
      );

      // Notify the marketer
      try {
        const marketer = await UserModel.findById(campaign.owner).select('_id').lean();
      if (marketer) {
        await NotificationService.createNotification({
          recipient: marketer._id,
          type: 'smart_invite',
          title: PROMOTER_NOTIFICATION_TITLE,
          message: `We found ${suggested.length} top promoters for your "${campaign.title}" campaign. Invite them now!`,
          data: { campaignId: campaign._id.toString(), suggestedCount: suggested.length },
        }).catch(() => {});
        }
      } catch (e) { /* notification is non-critical */ }
    }
  } catch (e) {
    console.error('[SmartInvite] Matchmaking failed:', e.message);
  }
}

export async function getSuggestedPromoters(campaignId, userId) {
  const campaign = await CampaignModel.findOne({ _id: campaignId, owner: userId })
    .select('aiSuggestedPromoters title category').lean();
  if (!campaign) throw new Error('Campaign not found');
  return campaign.aiSuggestedPromoters || [];
}

export async function smartInvitePromoters(campaignId, userId, promoterIds) {
  const campaign = await CampaignModel.findOne({ _id: campaignId, owner: userId }).lean();
  if (!campaign) throw new Error('Campaign not found');
  if (!Array.isArray(promoterIds) || !promoterIds.length) throw new Error('No promoters selected');

  let invited = 0;
  for (const pid of promoterIds.slice(0, 20)) {
    try {
      const { acceptCampaignDirect } = await import('../../controllers/accept-campaign.controller.js');
      await acceptCampaignDirect({ campaignId, userId: pid, req: { headers: {} } });
      invited++;
    } catch (e) { /* skip */ }
  }

  return { invited, total: promoterIds.length };
}
