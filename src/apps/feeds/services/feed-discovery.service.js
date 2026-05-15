import mongoose from 'mongoose';
import { FeedPostModel } from '../models/feed/index.js';
import { getForumContributorSpotlight, getForumHotTopics, getForumThreadHighlights } from '../../forum/services/forum-social.service.js';
import { FollowModel } from '../../profile/models/follow/index.js';
import { UserModel } from '../../user/models/user/index.js';
import { computeFreshnessBoost, getPrimaryMediaType } from '../models/feed/feed.utils.js';

const AUTHOR_POPULATION = {
  path: 'author',
  select: 'username displayName avatar role rating badge personalInfo isVerified'
};

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

  return {
    ...post,
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

  await Promise.all(posts.map(async (post) => {
    const update = {
      $inc: { 'reach.impressions': 1 },
      $set: { 'reach.lastImpressionAt': new Date() }
    };

    if (userId) {
      update.$addToSet = { 'reach.uniqueViews': userId };
    }

    await FeedPostModel.findByIdAndUpdate(post._id, update).catch(() => null);
  }));
};

export const buildAudienceSignals = async (userId) => {
  if (!userId) {
    return {
      followingIds: new Set(),
      authorAffinity: new Map(),
      hashtagAffinity: new Map(),
      categoryAffinity: new Map(),
      typeAffinity: new Map()
    };
  }

  const [followingIds, engagedPosts] = await Promise.all([
    FollowModel.find({ follower: userId }).distinct('following'),
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

  const authorAffinity = new Map();
  const hashtagAffinity = new Map();
  const categoryAffinity = new Map();
  const typeAffinity = new Map();

  engagedPosts.forEach((post) => {
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
    followingIds: new Set((followingIds || []).map((value) => value?.toString?.()).filter(Boolean)),
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

  if (mode === 'following') {
    return followingBoost + freshnessBoost + (engagementScore * 0.55) + authorBoost + mediaBoost;
  }

  if (mode === 'trending') {
    return (post.trendingScore || 0) * 1.5 + engagementScore + mediaBoost + challengeBoost + featuredBoost;
  }

  if (mode === 'latest') {
    return freshnessBoost * 3 + mediaBoost + followingBoost;
  }

  return engagementScore + freshnessBoost + followingBoost + authorBoost + hashtagOverlap + categoryBoost + typeBoost + mediaBoost + featuredBoost + challengeBoost;
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
    .populate(AUTHOR_POPULATION)
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(candidateLimit)
    .lean();

  const scored = candidates.map((post) => ({
    ...post,
    recommendationScore: scoreFeedPost(post, signals, mode)
  }));

  scored.sort((a, b) => {
    if (b.recommendationScore !== a.recommendationScore) {
      return b.recommendationScore - a.recommendationScore;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return scored;
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
};

export const getAuthorPopulation = () => AUTHOR_POPULATION;

export const buildFollowingAuthorQuery = async (userId) => {
  if (!userId) return null;
  const ids = await FollowModel.find({ follower: userId }).distinct('following');
  if (!ids.length) return [];
  return ids.map((value) => toObjectId(value)).filter(Boolean);
};
