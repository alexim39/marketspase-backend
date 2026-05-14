import { FeedPostModel } from '../models/feed/index.js';
import {
  buildFollowingAuthorQuery,
  fetchFeedCandidates,
  getFeedDiscoveryPayload,
  shapeFeedPost,
  trackFeedImpressions
} from '../services/feed-discovery.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getCommunityFeed = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    hashtag,
    search,
    feedType = 'for_you',
    author,
    challengeTag
  } = req.query;

  const userId = req.userId || null;
  const pageNum = parsePositiveInt(page, 1);
  const limitNum = Math.min(24, parsePositiveInt(limit, 12));
  const skip = (pageNum - 1) * limitNum;

  const query = { status: 'published' };

  if (type && type !== 'all') {
    query.type = type;
  }

  if (hashtag) {
    query['hashtags.tag'] = hashtag.toString().toLowerCase();
  }

  if (challengeTag) {
    query['challenge.tag'] = challengeTag.toString().replace(/^#/, '').toLowerCase();
  }

  if (author) {
    query.author = author;
  }

  if (search?.toString().trim()) {
    const regex = { $regex: search.toString().trim(), $options: 'i' };
    query.$or = [
      { content: regex },
      { 'hashtags.tag': regex },
      { 'challenge.tag': regex },
      { 'campaign.name': regex },
      { 'product.name': regex },
      { 'product.category': regex }
    ];
  }

  const normalizedFeedType = feedType === 'following'
    ? 'following'
    : feedType === 'trending'
      ? 'trending'
      : feedType === 'latest'
        ? 'latest'
        : 'for_you';

  if (normalizedFeedType === 'following') {
    const followingIds = await buildFollowingAuthorQuery(userId);
    query.author = Array.isArray(followingIds) && followingIds.length
      ? { $in: followingIds }
      : null;
  }

  if (query.author === null) {
    return res.status(200).json(
      new ApiResponse(200, {
        posts: [],
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
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0
        },
        sortMode: normalizedFeedType
      }, 'Community feed fetched successfully')
    );
  }

  const [discovery, candidates] = await Promise.all([
    getFeedDiscoveryPayload({ status: 'published' }),
    fetchFeedCandidates({
      query,
      page: pageNum,
      limit: limitNum,
      mode: normalizedFeedType,
      userId
    })
  ]);

  const total = candidates.length;
  const pagedPosts = candidates.slice(skip, skip + limitNum).map((post) => shapeFeedPost(post, userId));

  await trackFeedImpressions(pagedPosts, userId).catch((error) => {
    console.error('Failed to track feed impressions:', error);
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts: pagedPosts,
        stats: discovery.stats,
        trendingHashtags: discovery.trendingHashtags,
        trendingChallenges: discovery.trendingChallenges,
        creatorSpotlight: discovery.creatorSpotlight,
        forumHighlights: discovery.forumHighlights,
        hotTopics: discovery.hotTopics,
        forumSpotlight: discovery.forumSpotlight,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.max(1, Math.ceil(total / limitNum))
        },
        sortMode: normalizedFeedType
      },
      'Community feed fetched successfully'
    )
  );
});
