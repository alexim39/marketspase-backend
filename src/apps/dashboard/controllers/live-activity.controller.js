import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { FeedPostModel } from '../../feeds/models/feed/index.js';
import { ThreadModel } from '../../forum/models/thread/index.js';
import { ProductModel } from '../../store/models/promotion/product/product.model.js';

const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 12;

const clampLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsed)));
};

const getWindowStart = (hours = 24) => new Date(Date.now() - hours * 60 * 60 * 1000);

const toIso = (value) => {
  try {
    return value ? new Date(value).toISOString() : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
};

const normalizeActor = (userLike, fallbackName = 'A MarketSpase user') => ({
  author: userLike?.displayName || userLike?.username || fallbackName,
  authorId: userLike?._id?.toString?.() || '',
  avatar: userLike?.avatar || 'img/avatar.png',
  role: userLike?.role || 'member',
});

const buildFeedActivity = (post) => {
  const actor = normalizeActor(post.author, 'A marketer');
  const sourceLabel = post.source === 'product'
    ? 'shared a product spotlight'
    : post.source === 'campaign'
      ? 'shared a campaign update'
      : 'shared a new social post';

  return {
    id: `feed:${post._id}`,
    type: 'post',
    createdAt: toIso(post.createdAt),
    actionUrl: `/feed/${post._id}`,
    title: post.content?.slice?.(0, 100) || 'New social update',
    message: sourceLabel,
    ...actor,
  };
};

const buildForumActivity = (thread) => {
  const actor = normalizeActor(thread.author, 'A community member');
  return {
    id: `forum:${thread._id}`,
    type: 'forum',
    createdAt: toIso(thread.createdAt),
    actionUrl: `/dashboard/community/discussion/${thread._id}`,
    title: thread.title || 'New discussion',
    message: `started a discussion: "${thread.title || 'New thread'}"`,
    ...actor,
  };
};

const buildCampaignActivity = (campaign) => {
  const actor = normalizeActor(campaign.owner, 'A marketer');
  return {
    id: `campaign:${campaign._id}`,
    type: 'campaign',
    createdAt: toIso(campaign.createdAt),
    actionUrl: `/dashboard/campaigns`,
    title: campaign.title || 'New campaign',
    message: `created a campaign: "${campaign.title || 'New campaign'}"`,
    ...actor,
  };
};

const buildProductActivity = (product) => {
  const actor = normalizeActor(product.createdBy || product.store?.owner, 'A store owner');
  const storeName = product.store?.name ? ` in ${product.store.name}` : '';

  return {
    id: `product:${product._id}`,
    type: 'product',
    createdAt: toIso(product.publishedAt || product.createdAt),
    actionUrl: `/dashboard/stores/products`,
    title: product.name || 'New product',
    message: `published a product${storeName}: "${product.name || 'New product'}"`,
    ...actor,
  };
};

export const getLiveActivityFeed = async (req, res) => {
  const limit = clampLimit(req.query.limit);
  const recentWindowStart = getWindowStart(72);
  const summaryWindowStart = getWindowStart(24);

  const [recentPosts, recentThreads, recentCampaigns, recentProducts, summary] = await Promise.all([
    FeedPostModel.find({
      status: 'published',
      createdAt: { $gte: recentWindowStart },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('author', 'displayName username avatar role')
      .lean(),
    ThreadModel.find({
      isDeleted: { $ne: true },
      isHidden: { $ne: true },
      createdAt: { $gte: recentWindowStart },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('author', 'displayName username avatar role')
      .lean(),
    CampaignModel.find({
      isDeleted: { $ne: true },
      createdAt: { $gte: recentWindowStart },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('owner', 'displayName username avatar role')
      .lean(),
    ProductModel.find({
      isDeleted: { $ne: true },
      isPublished: true,
      createdAt: { $gte: recentWindowStart },
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .populate('createdBy', 'displayName username avatar role')
      .populate({
        path: 'store',
        select: 'name owner',
        populate: {
          path: 'owner',
          select: 'displayName username avatar role',
        },
      })
      .lean(),
    Promise.all([
      FeedPostModel.countDocuments({ status: 'published', createdAt: { $gte: summaryWindowStart } }),
      ThreadModel.countDocuments({ isDeleted: { $ne: true }, isHidden: { $ne: true }, createdAt: { $gte: summaryWindowStart } }),
      CampaignModel.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: summaryWindowStart } }),
      ProductModel.countDocuments({ isDeleted: { $ne: true }, isPublished: true, createdAt: { $gte: summaryWindowStart } }),
    ]),
  ]);

  const activities = [
    ...recentPosts.map(buildFeedActivity),
    ...recentThreads.map(buildForumActivity),
    ...recentCampaigns.map(buildCampaignActivity),
    ...recentProducts.map(buildProductActivity),
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);

  const [feedPosts24h, forumThreads24h, campaigns24h, products24h] = summary;

  return res.status(200).json({
    success: true,
    data: {
      activities,
      summary: {
        feedPosts24h,
        forumThreads24h,
        campaigns24h,
        products24h,
        total24h: feedPosts24h + forumThreads24h + campaigns24h + products24h,
      },
      refreshedAt: new Date().toISOString(),
    },
  });
};
