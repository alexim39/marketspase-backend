import { OnboardingModel } from '../models/onboarding.model.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { UserModel } from '../models/user/index.js';
import { LandingEventModel } from '../../campaign/models/landing-event.model.js';

// Onboarding — get/set completion state
export const getOnboardingState = async (req, res) => {
  try {
    let state = await OnboardingModel.findOne({ user: req.userId });
    if (!state) {
      state = await OnboardingModel.create({ user: req.userId });
    }
    return res.json({ success: true, data: state });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const completeOnboardingStep = async (req, res) => {
  try {
    const { step } = req.body;
    if (!step) return res.status(400).json({ success: false, message: 'Step name required.' });

    const state = await OnboardingModel.findOneAndUpdate(
      { user: req.userId },
      { $addToSet: { completedSteps: step }, completed: true, completedAt: new Date() },
      { upsert: true, new: true },
    );
    return res.json({ success: true, data: state });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const dismissOnboarding = async (req, res) => {
  try {
    await OnboardingModel.findOneAndUpdate(
      { user: req.userId },
      { dismissed: true },
      { upsert: true },
    );
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// Campaign matching — ranked campaigns for a promoter based on category affinity
export const getMatchingCampaigns = async (req, res) => {
  try {
    const promoterId = req.userId;
    const promoter = await UserModel.findById(promoterId).select('personalInfo.categories').lean();

    const preferredCategories = promoter?.personalInfo?.categories || [];

    const campaigns = await CampaignModel.find({
      status: 'active',
      isDeleted: false,
      hasEnded: false,
    })
      .select('title category caption mediaUrl campaignGoal budget status owner')
      .populate('owner', 'displayName avatar')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Score campaigns: exact category match +2, partial +1, popular +0.5
    const scored = campaigns.map(c => {
      let score = 0;
      if (preferredCategories.length && c.category) {
        const cat = c.category.toLowerCase();
        if (preferredCategories.some(pc => cat === pc.toLowerCase())) score += 2;
        else if (preferredCategories.some(pc => cat.includes(pc.toLowerCase()))) score += 1;
      }
      score += (c.totalPromotions || 0) * 0.1; // popularity bonus
      return { ...c, matchScore: score };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);

    return res.json({ success: true, data: scored.slice(0, 12) });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// Campaign auto-renew — toggle + scheduler
export const setCampaignAutoRenew = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { enabled, maxTopUps, topUpAmount } = req.body;

    const campaign = await CampaignModel.findOne({ _id: campaignId, owner: req.userId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    campaign.autoRenew = {
      enabled: !!enabled,
      maxTopUps: maxTopUps || 3,
      topUpAmount: topUpAmount || campaign.budget,
      topUpCount: 0,
    };

    await campaign.save();
    return res.json({ success: true, data: campaign.autoRenew });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// Performance benchmarks — aggregate stats for comparison
export const getPerformanceBenchmarks = async (req, res) => {
  try {
    const [totalEvents, campaignStats] = await Promise.all([
      LandingEventModel.aggregate([
        { $match: { event: { $in: ['landing_view', 'lead_success'] } } },
        { $group: { _id: null, totalViews: { $sum: { $cond: [{ $eq: ['$event', 'landing_view'] }, 1, 0] } }, totalLeads: { $sum: { $cond: [{ $eq: ['$event', 'lead_success'] }, 1, 0] } } } },
      ]).then(r => r[0] || { totalViews: 0, totalLeads: 0 }),

      LandingEventModel.aggregate([
        { $match: { event: { $in: ['landing_view', 'lead_success'] } } },
        { $group: { _id: '$campaign', views: { $sum: { $cond: [{ $eq: ['$event', 'landing_view'] }, 1, 0] } }, leads: { $sum: { $cond: [{ $eq: ['$event', 'lead_success'] }, 1, 0] } } } },
        { $project: { conversionRate: { $cond: [{ $gt: ['$views', 0] }, { $divide: ['$leads', '$views'] }, 0] } } },
      ]),
    ]);

    const rates = campaignStats.map(c => c.conversionRate).filter(r => r > 0);
    rates.sort((a, b) => a - b);
    const median = rates[Math.floor(rates.length / 2)] || 0;
    const top25 = rates[Math.floor(rates.length * 0.75)] || 0;

    return res.json({
      success: true,
      data: {
        platformAvgConversionRate: totalEvents.totalViews > 0 ? Math.round((totalEvents.totalLeads / totalEvents.totalViews) * 100) : 0,
        medianConversionRate: Math.round(median * 100),
        top25ConversionRate: Math.round(top25 * 100),
        totalCampaigns: rates.length,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
