import mongoose from 'mongoose';
import { FeedPostModel } from '../models/feed/index.js';
import { getForumContributorSpotlight, getForumHotTopics, getForumThreadHighlights } from '../../forum/services/forum-social.service.js';
import { FollowModel } from '../../profile/models/follow/index.js';
import { UserModel } from '../../user/models/user/index.js';
import { computeFreshnessBoost, getPrimaryMediaType } from '../models/feed/feed.utils.js';

const AUTHOR_POPULATION = {
  path: 'author',
  select: [
    'username',
    'displayName',
    'avatar',
    'role',
    'rating',
    'badge',
    'personalInfo.phone',
    'isVerified',
    'isActive',
    'isDeleted',
    'fraudProfile.trustScore',
    'fraudProfile.riskLevel',
    'fraudProfile.suspendedUntil'
  ].join(' ')
};

const ACTIVE_CAMPAIGN_FEED_STATUSES = new Set(['active', 'approved', 'accepted', 'running']);
const BLOCKED_CAMPAIGN_FEED_STATUSES = new Set(['rejected', 'completed', 'exhausted', 'expired', 'pending', 'draft', 'archived', 'paused']);
const BLOCKED_CREATOR_RISK_LEVELS = new Set(['critical']);
const HIGH_RISK_CREATOR_PENALTY = {
  low: 0,
  medium: 8,
  high: 22,
  critical: 1000
};

const FEED_CANDIDATE_FIELDS = [
  'author',
  'content',
  'source',
  'type',
  'earnings',
  'campaign',
  'product',
  'challenge',
  'tip',
  'media',
  'likes',
  'comments',
  'shares',
  'savedBy',
  'socialMetrics',
  'hashtags',
  'createdAt',
  'updatedAt',
  'isFeatured',
  'badge',
  'mentions',
  'featuredUntil',
  'status',
  'settings',
  'moderation',
  'recommendation',
  'trendingScore',
  'spotlightScore'
].join(' ');

const DISCOVERY_CACHE_TTL_MS = 2 * 60 * 1000;
const discoveryCache = new Map();

const DEFAULT_DISCOVERY = {
  stats: {
    postsToday: 0,
    activeUsers: 0,
    totalEngagement: 0,
    topHashtag: ''
  },
  trendingHashtags: [],
  trendingChallenges: [],
  creatorSpotlight: [],
  forumHighlights: [],
  hotTopics: [],
  forumSpotlight: [],
};

const toObjectId = (value) => {
  try {
    return new mongoose.Types.ObjectId(value);
  } catch {
    return null;
  }
};

const incrementMap = (map, key, amount = 1) => {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
};

const normalizeStringArray = (values = []) =>
  values
    .map((value) => value?.toString?.().trim?.().toLowerCase?.() || '')
    .filter(Boolean);

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.toHexString === 'function') return value.toHexString();
  if (typeof value === 'object' && value._id && value._id !== value) return toIdString(value._id);
  return String(value);
};

const hasDatePassed = (value, now = new Date()) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime();
};

const normalizeStatus = (value = '') => value?.toString?.().trim?.().toLowerCase?.() || '';

const getCampaignStatus = (post) =>
  normalizeStatus(post?.campaign?.campaignId?.status || post?.campaign?.status);

const getProductDocument = (post) =>
  post?.product?.productId && typeof post.product.productId === 'object'
    ? post.product.productId
    : null;

const getStoreDocument = (post) =>
  post?.product?.storeId && typeof post.product.storeId === 'object'
    ? post.product.storeId
    : null;

export const sanitizeFeedAuthor = (author) => {
  if (!author) return null;

  return {
    _id: author._id,
    username: author.username,
    displayName: author.displayName,
    avatar: author.avatar,
    role: author.role,
    rating: author.rating,
    badge: author.badge,
    personalInfo: author.personalInfo?.phone
      ? { phone: author.personalInfo.phone }
      : undefined,
    isVerified: author.isVerified
  };
};

const sanitizeCampaignSummary = (campaign = null) => {
  if (!campaign) return campaign;
  const campaignDoc = campaign.campaignId && typeof campaign.campaignId === 'object'
    ? campaign.campaignId
    : null;

  return {
    ...campaign,
    campaignId: campaignDoc
      ? {
          _id: campaignDoc._id,
          title: campaignDoc.title,
          budget: campaignDoc.budget,
          status: campaignDoc.status,
          link: campaignDoc.link,
          mediaUrl: campaignDoc.mediaUrl,
          mediaType: campaignDoc.mediaType,
          thumbnailUrl: campaignDoc.thumbnailUrl,
          category: campaignDoc.category
        }
      : campaign.campaignId
  };
};

const sanitizeProductSummary = (product = null) => {
  if (!product) return product;
  const productDoc = getProductDocument({ product });
  const storeDoc = getStoreDocument({ product });

  return {
    ...product,
    productId: productDoc
      ? {
          _id: productDoc._id,
          name: productDoc.name,
          price: productDoc.price,
          originalPrice: productDoc.originalPrice,
          currency: productDoc.currency,
          category: productDoc.category,
          images: productDoc.images
        }
      : product.productId,
    storeId: storeDoc
      ? {
          _id: storeDoc._id,
          name: storeDoc.name,
          storeLink: storeDoc.storeLink
        }
      : product.storeId
  };
};

export const isEligibleFeedPost = (post, { now = new Date() } = {}) => {
  if (!post || post.status !== 'published') return false;
  if (post.moderation?.isFlagged === true) return false;

  const author = post.author;
  if (!author) return false;
  if (author.isActive === false || author.isDeleted === true) return false;
  const riskLevel = normalizeStatus(author.fraudProfile?.riskLevel || 'low');
  if (BLOCKED_CREATOR_RISK_LEVELS.has(riskLevel)) return false;
  if (author.fraudProfile?.suspendedUntil && !hasDatePassed(author.fraudProfile.suspendedUntil, now)) {
    return false;
  }

  if (post.type === 'campaign' || post.source === 'campaign') {
    const campaignStatus = getCampaignStatus(post);
    const campaignDoc = post.campaign?.campaignId && typeof post.campaign.campaignId === 'object'
      ? post.campaign.campaignId
      : null;

    if (campaignDoc?.isDeleted === true) return false;
    if (campaignStatus && BLOCKED_CAMPAIGN_FEED_STATUSES.has(campaignStatus)) return false;
    if (campaignStatus && !ACTIVE_CAMPAIGN_FEED_STATUSES.has(campaignStatus)) return false;
    if (campaignDoc?.hasEndDate && hasDatePassed(campaignDoc.endDate, now)) return false;
  }

  if (post.type === 'product' || post.source === 'product') {
    const productDoc = getProductDocument(post);
    const storeDoc = getStoreDocument(post);

    if (productDoc) {
      if (productDoc.isDeleted === true || productDoc.isActive === false || productDoc.isPublished === false) return false;
      if (productDoc.scheduledStart && !hasDatePassed(productDoc.scheduledStart, now)) return false;
      if (hasDatePassed(productDoc.scheduledEnd, now)) return false;
    }

    if (storeDoc && (storeDoc.isActive === false || storeDoc.isDeleted === true)) return false;
  }

  return true;
};

const getTrustScore = (author) => {
  const value = Number(author?.fraudProfile?.trustScore);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 100;
};

const getCreatorQualityScore = (post) => {
  const author = post.author || {};
  const rating = Number(author.rating || 0);
  const trustScore = getTrustScore(author);
  const riskLevel = normalizeStatus(author.fraudProfile?.riskLevel || 'low');
  const verifiedBoost = author.isVerified ? 5 : 0;
  const quality = (trustScore / 100) * 16 + Math.min(rating, 5) * 2 + verifiedBoost;

  return quality - (HIGH_RISK_CREATOR_PENALTY[riskLevel] || 0);
};

const getRoleRelevanceScore = (post, viewerRole = 'guest') => {
  const role = normalizeStatus(viewerRole || 'guest');
  const type = normalizeStatus(post.type);
  const source = normalizeStatus(post.source);

  if (role === 'promoter') {
    if (type === 'campaign' || source === 'campaign') return 18;
    if (type === 'product' || source === 'product') return 16;
    if (type === 'tip' || type === 'challenge') return 10;
    return 2;
  }

  if (role === 'marketer') {
    if (type === 'product' || source === 'product') return 14;
    if (type === 'campaign' || source === 'campaign') return 12;
    if (type === 'achievement' || type === 'milestone') return 8;
    return 3;
  }

  if (type === 'product') return 10;
  if (type === 'story' || type === 'tip') return 6;
  return 2;
};

const getBusinessSignalScore = (post) => {
  const productDoc = getProductDocument(post);
  const purchaseCount = Number(productDoc?.purchaseCount || 0);
  const viewCount = Number(productDoc?.viewCount || 0);
  const productConversionRate = viewCount > 0 ? purchaseCount / viewCount : 0;
  const productSignal = Math.min(18, purchaseCount * 0.75 + productConversionRate * 40);

  const campaignDoc = post.campaign?.campaignId && typeof post.campaign.campaignId === 'object'
    ? post.campaign.campaignId
    : null;
  const billableClicks = Number(campaignDoc?.billableClicks || 0);
  const totalClicks = Number(campaignDoc?.totalClicks || 0);
  const clickQuality = totalClicks > 0 ? billableClicks / totalClicks : 0;
  const campaignSignal = Math.min(14, billableClicks * 0.25 + clickQuality * 8);

  return productSignal + campaignSignal;
};

const getStableExplorationBoost = (post, userId = '') => {
  const key = `${toIdString(post?._id)}:${userId || 'guest'}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return (hash % 700) / 100;
};

export const diversifyRankedPosts = (posts = [], { mode = 'for_you' } = {}) => {
  if (!Array.isArray(posts) || posts.length <= 2 || mode === 'latest') {
    return posts;
  }

  const remaining = [...posts];
  const result = [];
  const recentAuthors = [];
  const recentTypes = [];

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const post = remaining[index];
      const authorId = toIdString(post.author?._id || post.author);
      const type = post.type || post.source || 'post';
      const authorPenalty = recentAuthors.includes(authorId) ? 14 : 0;
      const typePenalty = recentTypes.includes(type) ? 6 : 0;
      const adjustedScore = Number(post.recommendationScore || 0) - authorPenalty - typePenalty;

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestIndex = index;
      }
    }

    const [selected] = remaining.splice(bestIndex, 1);
    result.push(selected);
    recentAuthors.unshift(toIdString(selected.author?._id || selected.author));
    recentTypes.unshift(selected.type || selected.source || 'post');
    recentAuthors.splice(3);
    recentTypes.splice(3);
  }

  return result;
};

export const shapeFeedPost = (post, userId = null) => {
  const likeCount = Array.isArray(post.likes) ? post.likes.length : post.likeCount || 0;
  const commentCount = Array.isArray(post.comments) ? post.comments.length : post.commentCount || 0;
  const shareCount = Array.isArray(post.shares) ? post.shares.length : post.shareCount || 0;
  const saveCount = Array.isArray(post.savedBy) ? post.savedBy.length : post.saveCount || 0;
  const chatCount = post.socialMetrics?.chatClicks || post.socialMetrics?.externalClicks || post.chatCount || 0;

  const currentUserId = userId?.toString?.() || null;
  const isLiked = currentUserId
    ? (post.likes || []).some((entry) => entry?.user?.toString?.() === currentUserId)
    : Boolean(post.isLiked);
  const isSaved = currentUserId
    ? (post.savedBy || []).some((entry) => entry?.user?.toString?.() === currentUserId)
    : Boolean(post.isSaved);

  const sanitizedAuthor = sanitizeFeedAuthor(post.author);
  const sanitizedCampaign = sanitizeCampaignSummary(post.campaign);
  const sanitizedProduct = sanitizeProductSummary(post.product);

  return {
    ...post,
    author: sanitizedAuthor,
    campaign: sanitizedCampaign,
    product: sanitizedProduct,
    likeCount,
    commentCount,
    shareCount,
    chatCount,
    saveCount,
    isLiked,
    isSaved,
    phone: post.author?.personalInfo?.phone || '',
    isCarousel: Array.isArray(post.media) && post.media.length > 1,
    mediaCount: Array.isArray(post.media) ? post.media.length : 0,
    primaryMediaType: getPrimaryMediaType(post),
    spotlightScore: post.spotlightScore || 0,
    recommendationScore: post.recommendationScore || 0
  };
};

export const trackFeedImpressions = async (posts, userId = null) => {
  if (!Array.isArray(posts) || posts.length === 0) return;

  const now = new Date();
  const operations = posts
    .filter((post) => post?._id)
    .map((post) => {
      const update = {
        $inc: { 'reach.impressions': 1 },
        $set: { 'reach.lastImpressionAt': now }
      };

      if (userId) {
        update.$addToSet = { 'reach.uniqueViews': userId };
      }

      return {
        updateOne: {
          filter: { _id: post._id },
          update
        }
      };
    });

  if (!operations.length) {
    return;
  }

  await FeedPostModel.bulkWrite(operations, { ordered: false }).catch(() => null);
};

export const buildAudienceSignals = async (userId) => {
  if (!userId) {
    return {
      userId: null,
      viewerRole: 'guest',
      followingIds: new Set(),
      authorAffinity: new Map(),
      hashtagAffinity: new Map(),
      categoryAffinity: new Map(),
      typeAffinity: new Map()
    };
  }

  const [followingIds, viewer, engagedPosts] = await Promise.all([
    FollowModel.find({ follower: userId }).distinct('following'),
    UserModel.findById(userId)
      .select('role interests preferences personalInfo.address.country personalInfo.address.state')
      .lean(),
    FeedPostModel.find({
      status: 'published',
      $or: [
        { 'likes.user': userId },
        { 'savedBy.user': userId },
        { 'comments.user': userId }
      ]
    })
      .select('author hashtags type recommendation product campaign')
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean()
  ]);

  const resolvedFollowingIds = Array.isArray(followingIds) ? followingIds : [];
  const resolvedEngagedPosts = Array.isArray(engagedPosts) ? engagedPosts : [];

  const authorAffinity = new Map();
  const hashtagAffinity = new Map();
  const categoryAffinity = new Map();
  const typeAffinity = new Map();

  resolvedEngagedPosts.forEach((post) => {
    incrementMap(authorAffinity, post.author?.toString?.(), 3);
    incrementMap(typeAffinity, post.type, 2);

    (post.hashtags || []).forEach((entry) => incrementMap(hashtagAffinity, entry?.tag, 2));

    const categories = normalizeStringArray([
      post.recommendation?.primaryCategory,
      post.product?.category,
      post.campaign?.category
    ]);

    categories.forEach((category) => incrementMap(categoryAffinity, category, 2));
  });

  return {
    userId: userId?.toString?.() || String(userId),
    viewerRole: viewer?.role || 'guest',
    followingIds: new Set((resolvedFollowingIds || []).map((value) => value?.toString?.()).filter(Boolean)),
    authorAffinity,
    hashtagAffinity,
    categoryAffinity,
    typeAffinity
  };
};

export const scoreFeedPost = (post, signals, mode = 'for_you') => {
  const likeCount = Array.isArray(post.likes) ? post.likes.length : 0;
  const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
  const shareCount = Array.isArray(post.shares) ? post.shares.length : 0;
  const saveCount = Array.isArray(post.savedBy) ? post.savedBy.length : 0;
  const chatCount = post.socialMetrics?.chatClicks || post.socialMetrics?.externalClicks || 0;
  const freshnessBoost = computeFreshnessBoost(post.createdAt);
  const engagementScore = (likeCount * 2.2) + (commentCount * 3.4) + (shareCount * 3.1) + (chatCount * 2.6) + (saveCount * 1.5) + (post.trendingScore || 0);
  const followingBoost = signals.followingIds.has(post.author?._id?.toString?.() || post.author?.toString?.()) ? 18 : 0;
  const authorBoost = signals.authorAffinity.get(post.author?._id?.toString?.() || post.author?.toString?.()) || 0;
  const typeBoost = signals.typeAffinity.get(post.type) || 0;

  const hashtagOverlap = (post.hashtags || []).reduce((sum, entry) => {
    const tag = entry?.tag?.toString?.().toLowerCase?.();
    return sum + (signals.hashtagAffinity.get(tag) || 0);
  }, 0);

  const categories = normalizeStringArray([
    post.recommendation?.primaryCategory,
    post.product?.category,
    post.campaign?.category
  ]);
  const categoryBoost = categories.reduce((sum, category) => sum + (signals.categoryAffinity.get(category) || 0), 0);

  const mediaBoost = (post.media?.length || 0) > 1
    ? 4
    : post.media?.[0]?.type === 'video'
      ? 5
      : post.media?.length
        ? 2
        : 0;

  const featuredBoost = post.isFeatured ? 10 : 0;
  const challengeBoost = post.challenge?.tag ? 4 : 0;
  const roleRelevance = getRoleRelevanceScore(post, signals.viewerRole);
  const creatorQuality = getCreatorQualityScore(post);
  const businessSignal = getBusinessSignalScore(post);
  const explorationBoost = getStableExplorationBoost(post, signals.userId || signals.viewerRole);

  if (mode === 'following') {
    return followingBoost + freshnessBoost + (engagementScore * 0.55) + authorBoost + mediaBoost + creatorQuality;
  }

  if (mode === 'trending') {
    return (post.trendingScore || 0) * 1.5 + engagementScore + mediaBoost + challengeBoost + featuredBoost + creatorQuality + businessSignal;
  }

  if (mode === 'latest') {
    return freshnessBoost * 3 + mediaBoost + followingBoost + creatorQuality;
  }

  return engagementScore + freshnessBoost + followingBoost + authorBoost + hashtagOverlap + categoryBoost + typeBoost + mediaBoost + featuredBoost + challengeBoost + roleRelevance + creatorQuality + businessSignal + explorationBoost;
};

export const fetchFeedCandidates = async ({
  query,
  page = 1,
  limit = 10,
  mode = 'for_you',
  userId = null
}) => {
  const signals = await buildAudienceSignals(userId);
  const candidateLimit = Math.min(180, Math.max(limit * Math.max(page, 1) * 4, 60));

  const candidates = await FeedPostModel.find(query)
    .select(FEED_CANDIDATE_FIELDS)
    .populate(AUTHOR_POPULATION)
    .populate('campaign.campaignId', 'title budget status link mediaUrl mediaType thumbnailUrl category isDeleted hasEndDate endDate totalClicks billableClicks')
    .populate('product.productId', 'name price originalPrice currency category images isActive isDeleted isPublished scheduledStart scheduledEnd viewCount purchaseCount')
    .populate('product.storeId', 'name storeLink isActive isDeleted')
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(candidateLimit)
    .lean();

  const uniqueCandidates = [];
  const seenPostIds = new Set();

  for (const candidate of candidates) {
    const postId = toIdString(candidate._id);
    if (!postId || seenPostIds.has(postId)) continue;
    seenPostIds.add(postId);
    if (!isEligibleFeedPost(candidate)) continue;
    uniqueCandidates.push(candidate);
  }

  const scored = uniqueCandidates.map((post) => ({
    ...post,
    isFeatured: Boolean(post.isFeatured && (!post.featuredUntil || !hasDatePassed(post.featuredUntil))),
    recommendationScore: scoreFeedPost(post, signals, mode)
  }));

  scored.sort((a, b) => {
    if (b.recommendationScore !== a.recommendationScore) {
      return b.recommendationScore - a.recommendationScore;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return diversifyRankedPosts(scored, { mode });
};

export const getCreatorSpotlight = async ({ timeframeDays = 7, limit = 5 } = {}) => {
  const since = new Date();
  since.setDate(since.getDate() - timeframeDays);

  const spotlight = await FeedPostModel.aggregate([
    { $match: { status: 'published', createdAt: { $gte: since } } },
    {
      $project: {
        author: 1,
        engagementPoints: {
          $add: [
            { $multiply: [{ $size: '$likes' }, 2] },
            { $multiply: [{ $size: '$comments' }, 3] },
            { $multiply: [{ $size: '$shares' }, 2] },
            { $multiply: [{ $ifNull: ['$socialMetrics.chatClicks', '$socialMetrics.externalClicks'] }, 2] },
            { $cond: ['$challenge.tag', 4, 0] },
            { $cond: ['$product.productId', 3, 0] }
          ]
        },
        postCount: { $literal: 1 }
      }
    },
    {
      $group: {
        _id: '$author',
        postCount: { $sum: '$postCount' },
        engagementPoints: { $sum: '$engagementPoints' }
      }
    },
    { $sort: { engagementPoints: -1, postCount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: '$user._id',
        displayName: '$user.displayName',
        username: '$user.username',
        avatar: '$user.avatar',
        role: '$user.role',
        rating: '$user.rating',
        badge: { $ifNull: ['$user.gamificationProfile.currentLevelTitle', '$user.badgeProfile.levelTitle'] },
        engagementPoints: 1,
        postCount: 1
      }
    }
  ]);

  return spotlight;
};

export const getTrendingChallenges = async ({ limit = 5 } = {}) => {
  const now = new Date();

  return FeedPostModel.aggregate([
    {
      $match: {
        status: 'published',
        'challenge.tag': { $exists: true, $ne: '' },
        $or: [
          { 'challenge.endsAt': { $exists: false } },
          { 'challenge.endsAt': null },
          { 'challenge.endsAt': { $gte: now } }
        ]
      }
    },
    {
      $group: {
        _id: '$challenge.tag',
        title: { $first: '$challenge.title' },
        description: { $first: '$challenge.description' },
        rewardLabel: { $first: '$challenge.rewardLabel' },
        postCount: { $sum: 1 },
        totalEngagement: {
          $sum: {
            $add: [
              { $size: '$likes' },
              { $size: '$comments' },
              { $size: '$shares' },
              { $ifNull: ['$socialMetrics.chatClicks', '$socialMetrics.externalClicks'] }
            ]
          }
        }
      }
    },
    { $sort: { totalEngagement: -1, postCount: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        tag: '$_id',
        title: { $ifNull: ['$title', 'Challenge'] },
        description: 1,
        rewardLabel: 1,
        postCount: 1,
        totalEngagement: 1
      }
    }
  ]);
};

export const getTrendingHashtagsSummary = async ({ query = { status: 'published' }, limit = 8 } = {}) =>
  FeedPostModel.aggregate([
    { $match: query },
    { $unwind: '$hashtags' },
    { $match: { 'hashtags.tag': { $exists: true, $ne: '' } } },
    { $group: { _id: '$hashtags.tag', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, tag: '$_id', count: 1 } }
  ]);

export const getFeedDiscoveryPayload = async (query = {}) => {
  const cacheKey = JSON.stringify(query || {});
  const cached = discoveryCache.get(cacheKey);
  if (cached?.value && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = (async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    postsToday,
    activeUsers,
    trendingHashtags,
    trendingChallenges,
    creatorSpotlight,
    engagementTotals,
    forumHighlights,
    hotTopics,
    forumSpotlight,
  ] = await Promise.all([
    FeedPostModel.countDocuments({ ...query, createdAt: { $gte: today } }),
    UserModel.countDocuments({ lastSeenAt: { $gte: today }, role: { $in: ['marketer', 'promoter'] } }),
    getTrendingHashtagsSummary({ query }),
    getTrendingChallenges({}),
    getCreatorSpotlight({}),
    FeedPostModel.aggregate([
      { $match: query },
      {
        $project: {
          totalEngagement: {
            $add: [
              { $size: '$likes' },
              { $size: '$comments' },
              { $size: '$shares' },
              { $ifNull: ['$socialMetrics.chatClicks', '$socialMetrics.externalClicks'] }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalEngagement: { $sum: '$totalEngagement' }
        }
      }
    ]),
    getForumThreadHighlights({ limit: 4, timeframeDays: 10 }),
    getForumHotTopics({ limit: 6, timeframeDays: 10 }),
    getForumContributorSpotlight({ limit: 4, timeframeDays: 10 }),
  ]);

    return {
      ...DEFAULT_DISCOVERY,
      stats: {
        postsToday,
        activeUsers,
        totalEngagement: engagementTotals[0]?.totalEngagement || 0,
        topHashtag: trendingHashtags[0]?.tag || ''
      },
      trendingHashtags,
      trendingChallenges,
      creatorSpotlight,
      forumHighlights,
      hotTopics,
      forumSpotlight,
    };
  })();

  discoveryCache.set(cacheKey, { value: null, expiresAt: 0, promise });

  try {
    const value = await promise;
    discoveryCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
      promise: null
    });
    return value;
  } catch (error) {
    discoveryCache.delete(cacheKey);
    throw error;
  }
};

export const getAuthorPopulation = () => AUTHOR_POPULATION;

export const buildFollowingAuthorQuery = async (userId) => {
  if (!userId) return null;
  const ids = await FollowModel.find({ follower: userId }).distinct('following');
  if (!ids.length) return [];
  return ids.map((value) => toObjectId(value)).filter(Boolean);
};
