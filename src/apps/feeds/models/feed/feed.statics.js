import { calculateTrendingScore, formatPostResponse } from "./feed.utils.js";
import { TRENDING, FEED_POST_STATUS } from "./feed.constants.js";

export const setupFeedStatics = (schema) => {
  // Get feed for user
  schema.statics.getFeedForUser = async function(userId, options = {}) {
    const {
      limit = 20,
      skip = 0,
      types = null,
      excludeIds = [],
      includeTrending = true
    } = options;

    const query = {
      status: FEED_POST_STATUS.PUBLISHED,
      _id: { $nin: excludeIds }
    };

    if (types && types.length > 0) {
      query.type = { $in: types };
    }

    // Get regular feed (most recent)
    const regularPosts = await this.find(query)
      .populate('author', 'username displayName avatar rating badge')
      .populate('mentions.user', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    // Get trending posts if requested
    let trendingPosts = [];
    if (includeTrending && skip === 0) {
      const threeDaysAgo = new Date(Date.now() - TRENDING.LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
      
      trendingPosts = await this.find({
        ...query,
        createdAt: { $gte: threeDaysAgo },
        trendingScore: { $gt: 0 }
      })
        .populate('author', 'username displayName avatar rating badge')
        .populate('mentions.user', 'username displayName')
        .sort({ trendingScore: -1 })
        .limit(5)
        .lean();
    }

    // Format posts for response
    const formatPosts = (posts) => posts.map(post => formatPostResponse(post, userId));

    return {
      feed: formatPosts(regularPosts),
      trending: formatPosts(trendingPosts),
      hasMore: regularPosts.length === limit
    };
  };

  // Get posts by author
  schema.statics.getByAuthor = async function(authorId, userId = null, options = {}) {
    const { limit = 20, skip = 0, includeDrafts = false } = options;

    const query = {
      author: authorId
    };

    if (!includeDrafts) {
      query.status = FEED_POST_STATUS.PUBLISHED;
    }

    const posts = await this.find(query)
      .populate('author', 'username displayName avatar rating badge')
      .populate('mentions.user', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return posts.map(post => formatPostResponse(post, userId));
  };

  // Get posts by hashtag
  schema.statics.getByHashtag = async function(hashtag, userId = null, options = {}) {
    const { limit = 20, skip = 0 } = options;

    const posts = await this.find({
      'hashtags.tag': hashtag.toLowerCase(),
      status: FEED_POST_STATUS.PUBLISHED
    })
      .populate('author', 'username displayName avatar rating badge')
      .populate('mentions.user', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return posts.map(post => formatPostResponse(post, userId));
  };

  // Get saved posts by user
  schema.statics.getSavedByUser = async function(userId, options = {}) {
    const { limit = 20, skip = 0 } = options;

    const posts = await this.find({
      'savedBy.user': userId,
      status: FEED_POST_STATUS.PUBLISHED
    })
      .populate('author', 'username displayName avatar rating badge')
      .populate('mentions.user', 'username displayName')
      .sort({ 'savedBy.savedAt': -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return posts.map(post => formatPostResponse(post, userId));
  };

  // Calculate trending scores (run as cron job)
  schema.statics.calculateTrendingScores = async function() {
    const threeDaysAgo = new Date(Date.now() - TRENDING.LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    
    const posts = await this.find({
      createdAt: { $gte: threeDaysAgo },
      status: FEED_POST_STATUS.PUBLISHED
    });

    const updates = posts.map(async (post) => {
      post.trendingScore = calculateTrendingScore(post);
      return post.save();
    });

    await Promise.all(updates);
    
    return {
      updated: updates.length,
      message: `Updated trending scores for ${updates.length} posts`
    };
  };

  // Get trending hashtags
  schema.statics.getTrendingHashtags = async function(limit = 10) {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const hashtags = await this.aggregate([
      {
        $match: {
          createdAt: { $gte: threeDaysAgo },
          status: FEED_POST_STATUS.PUBLISHED,
          'hashtags.0': { $exists: true }
        }
      },
      { $unwind: '$hashtags' },
      {
        $group: {
          _id: '$hashtags.tag',
          count: { $sum: 1 },
          posts: { $addToSet: '$_id' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          tag: '$_id',
          count: 1,
          postCount: { $size: '$posts' },
          _id: 0
        }
      }
    ]);

    return hashtags;
  };

  // Get feed statistics
  schema.statics.getStats = async function() {
    const stats = await this.aggregate([
      {
        $facet: {
          byType: [
            { $group: { _id: '$type', count: { $sum: 1 } } }
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalPosts: { $sum: 1 },
                totalLikes: { $sum: { $size: '$likes' } },
                totalComments: { $sum: { $size: '$comments' } },
                totalShares: { $sum: { $size: '$shares' } },
                totalImpressions: { $sum: '$reach.impressions' }
              }
            }
          ]
        }
      }
    ]);

    return stats[0];
  };

  // Get posts needing moderation
  schema.statics.getFlaggedPosts = async function() {
    return this.find({
      'moderation.isFlagged': true,
      status: { $ne: 'archived' }
    })
      .populate('author', 'username displayName email')
      .populate('moderation.flaggedBy', 'username displayName')
      .sort({ createdAt: -1 });
  };

  // Search posts
  schema.statics.search = async function(query, userId = null, options = {}) {
    const { limit = 20, skip = 0 } = options;

    const posts = await this.find({
      $text: { $search: query },
      status: FEED_POST_STATUS.PUBLISHED
    })
      .populate('author', 'username displayName avatar rating badge')
      .populate('mentions.user', 'username displayName')
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .skip(skip)
      .lean();

    return posts.map(post => formatPostResponse(post, userId));
  };
};