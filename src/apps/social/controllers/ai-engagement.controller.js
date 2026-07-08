import { scoreCommentQuality, generateDailySuggestions } from '../services/ai-engagement.service.js';
import { StoreModel } from '../../store/models/store/store.model.js';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { FeedPostModel } from '../../feeds/models/feed/index.js';

export async function scoreComment(req, res) {
  try {
    const { comment, postContent } = req.body;
    if (!comment) return res.status(400).json({ success: false, message: 'comment is required' });

    const score = await scoreCommentQuality(comment, postContent || '');
    return res.status(200).json({ success: true, data: { score } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDailySuggestions(req, res) {
  try {
    const userId = req.userId;

    // Gather marketer data
    const [stores, campaigns, recentPosts] = await Promise.all([
      StoreModel.find({ owner: userId, isDeleted: false }).select('name category analytics.totalViews analytics.totalSales').lean(),
      CampaignModel.find({ owner: userId, status: 'active', isDeleted: false }).countDocuments(),
      FeedPostModel.find({ author: userId, status: 'active' }).sort({ createdAt: -1 }).limit(5).select('content').lean()
    ]);

    const primaryStore = stores[0] || {};
    const marketerData = {
      storeName: primaryStore.name,
      category: primaryStore.category,
      totalSales: primaryStore.analytics?.totalSales || 0,
      totalViews: primaryStore.analytics?.totalViews || 0,
      activeCampaigns: campaigns,
      recentPosts: recentPosts.length
    };

    const suggestions = await generateDailySuggestions(marketerData);

    return res.status(200).json({ success: true, data: suggestions });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
