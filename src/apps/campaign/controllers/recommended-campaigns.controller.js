import { CampaignModel } from '../models/campaign.model.js';
import { CampaignClickModel } from '../models/campaign-click.model.js';
import { LandingEventModel } from '../models/landing-event.model.js';

export const getRecommendedCampaigns = async (req, res) => {
  try {
    const promoterId = req.userId;

    // Find promoter's top categories based on billable clicks
    const topCategories = await CampaignClickModel.aggregate([
      { $match: { promoter: new (await import('mongoose')).default.Types.ObjectId(promoterId), status: 'billable' } },
      { $lookup: { from: 'campaigns', localField: 'campaign', foreignField: '_id', as: 'campaign' } },
      { $unwind: '$campaign' },
      { $group: { _id: '$campaign.category', clicks: { $sum: 1 }, ctr: { $avg: { $cond: [{ $gt: ['$campaign.totalClicks', 0] }, { $divide: ['$clicks', '$campaign.totalClicks'] }, 0] } } } },
      { $sort: { clicks: -1 } },
      { $limit: 3 },
    ]);

    const categoryList = topCategories.map(c => c._id).filter(Boolean);

    // Find active campaigns in those categories the promoter hasn't already accepted
    const accepted = await CampaignClickModel.distinct('campaign', { promoter: promoterId });

    const filter = { status: 'active', isDeleted: false, _id: { $nin: accepted } };
    if (categoryList.length) filter.category = { $in: categoryList };

    const campaigns = await CampaignModel.find(filter)
      .select('title caption category budget costPerClick mediaUrl')
      .sort({ budget: -1 })
      .limit(6)
      .lean();

    const result = campaigns.map(c => ({
      _id: c._id,
      title: c.title,
      caption: c.caption?.substring(0, 80),
      category: c.category,
      budget: c.budget,
      cpc: c.costPerClick || 80,
      mediaUrl: c.mediaUrl,
      matchReason: categoryList.includes(c.category) ? `Top category: ${c.category}` : 'Popular campaign',
    }));

    res.json({ success: true, data: result });
  } catch (e) {
    console.error('Recommended campaigns error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to load recommendations.' });
  }
};
