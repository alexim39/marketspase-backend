import { THREAD_SORT, ERROR_MESSAGES, TRENDING } from "./thread.constants.js";
import { formatThreadResponse, calculateTrendingScore } from "./thread.utils.js";

export const setupThreadStatics = (schema) => {
  // Get threads with filtering and pagination
  schema.statics.getThreads = async function(options = {}) {
    const {
      limit = 20,
      skip = 0,
      category = null,
      tags = null,
      author = null,
      sortBy = THREAD_SORT.NEWEST,
      includePinned = true,
      userId = null,
      includeDeleted = false
    } = options;

    const query = { isDeleted: includeDeleted ? { $in: [true, false] } : false };
    
    if (category) {
      query.category = category;
    }
    
    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }
    
    if (author) {
      query.author = author;
    }

    // Determine sort order
    let sort = {};
    switch (sortBy) {
      case THREAD_SORT.NEWEST:
        sort = { createdAt: -1 };
        break;
      case THREAD_SORT.OLDEST:
        sort = { createdAt: 1 };
        break;
      case THREAD_SORT.MOST_LIKED:
        sort = { likeCount: -1, createdAt: -1 };
        break;
      case THREAD_SORT.MOST_COMMENTED:
        sort = { commentCount: -1, createdAt: -1 };
        break;
      case THREAD_SORT.MOST_VIEWED:
        sort = { viewCount: -1, createdAt: -1 };
        break;
      case THREAD_SORT.TRENDING:
        sort = { trendingScore: -1, createdAt: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    // Get pinned threads first if requested
    let pinnedThreads = [];
    if (includePinned) {
      pinnedThreads = await this.find({ ...query, isPinned: true })
        .populate('author', 'username displayName avatar')
        .populate('lastCommentBy', 'username')
        .sort({ pinnedAt: -1 })
        .lean();
    }

    // Get regular threads
    const threads = await this.find({ ...query, isPinned: false })
      .populate('author', 'username displayName avatar')
      .populate('lastCommentBy', 'username')
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();

    // Combine pinned and regular threads
    const allThreads = [...pinnedThreads, ...threads];
    
    // Format threads
    const formattedThreads = allThreads.map(thread => formatThreadResponse(thread, userId));

    // Get total count for pagination
    const total = await this.countDocuments({ ...query, isPinned: false });

    return {
      threads: formattedThreads,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + threads.length < total,
        pinnedCount: pinnedThreads.length
      }
    };
  };

  // Get thread by ID with populated fields
  schema.statics.getThreadById = async function(threadId, userId = null) {
    const thread = await this.findById(threadId)
      .populate('author', 'username displayName avatar rating')
      .populate('lastCommentBy', 'username displayName')
      .populate('likedBy', 'username')
      .populate('mentions.user', 'username displayName')
      .populate({
        path: 'comments',
        match: { isDeleted: false },
        populate: { path: 'author', select: 'username displayName avatar' }
      });

    if (!thread) {
      throw new Error(ERROR_MESSAGES.THREAD_NOT_FOUND);
    }

    return formatThreadResponse(thread, userId);
  };

  // Get threads by author
  schema.statics.getByAuthor = async function(authorId, options = {}) {
    return this.getThreads({
      ...options,
      author: authorId
    });
  };

  // Get threads by category
  schema.statics.getByCategory = async function(category, options = {}) {
    return this.getThreads({
      ...options,
      category
    });
  };

  // Get threads by tags
  schema.statics.getByTags = async function(tags, options = {}) {
    return this.getThreads({
      ...options,
      tags
    });
  };

  // Create a new thread
  schema.statics.createThread = async function(data) {
    const thread = new this(data);
    await thread.save();
    
    await thread.populate('author', 'username displayName avatar');
    
    return thread;
  };

  // Search threads
  schema.statics.search = async function(query, options = {}) {
    const { limit = 20, skip = 0, userId = null } = options;

    const threads = await this.find({
      $text: { $search: query },
      isDeleted: false
    })
      .populate('author', 'username displayName avatar')
      .populate('lastCommentBy', 'username')
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .skip(skip)
      .lean();

    const formattedThreads = threads.map(thread => formatThreadResponse(thread, userId));
    const total = await this.countDocuments({
      $text: { $search: query },
      isDeleted: false
    });

    return {
      threads: formattedThreads,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + threads.length < total
      }
    };
  };

  // Calculate trending scores (run as cron job)
  schema.statics.calculateTrendingScores = async function() {
    const sevenDaysAgo = new Date(Date.now() - TRENDING.LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    
    const threads = await this.find({
      createdAt: { $gte: sevenDaysAgo },
      isDeleted: false
    });

    const updates = threads.map(async (thread) => {
      thread.trendingScore = calculateTrendingScore(thread);
      return thread.save();
    });

    await Promise.all(updates);
    
    return {
      updated: updates.length,
      message: `Updated trending scores for ${updates.length} threads`
    };
  };

  // Get trending hashtags
  schema.statics.getTrendingHashtags = async function(limit = 10) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const hashtags = await this.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          isDeleted: false,
          'hashtags.0': { $exists: true }
        }
      },
      { $unwind: '$hashtags' },
      {
        $group: {
          _id: '$hashtags.tag',
          count: { $sum: '$hashtags.count' },
          threads: { $addToSet: '$_id' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          tag: '$_id',
          count: 1,
          threadCount: { $size: '$threads' },
          _id: 0
        }
      }
    ]);

    return hashtags;
  };

  // Get thread statistics
  schema.statics.getStats = async function() {
    const stats = await this.aggregate([
      { $match: { isDeleted: false } },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalThreads: { $sum: 1 },
                totalLikes: { $sum: '$likeCount' },
                totalComments: { $sum: '$commentCount' },
                totalViews: { $sum: '$viewCount' },
                pinnedThreads: { $sum: { $cond: ['$isPinned', 1, 0] } },
                lockedThreads: { $sum: { $cond: ['$isLocked', 1, 0] } }
              }
            }
          ],
          byCategory: [
            {
              $group: {
                _id: '$category',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } }
          ],
          topContributors: [
            {
              $group: {
                _id: '$author',
                threadCount: { $sum: 1 },
                totalLikes: { $sum: '$likeCount' }
              }
            },
            { $sort: { threadCount: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'userDetails'
              }
            },
            { $unwind: '$userDetails' },
            {
              $project: {
                _id: 1,
                username: '$userDetails.username',
                displayName: '$userDetails.displayName',
                avatar: '$userDetails.avatar',
                threadCount: 1,
                totalLikes: 1
              }
            }
          ],
          activityByDay: [
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.date': -1 } },
            { $limit: 30 }
          ]
        }
      }
    ]);

    return stats[0];
  };

  // Bulk update threads (admin function)
  schema.statics.bulkUpdate = async function(threadIds, updates, updatedBy) {
    const result = await this.updateMany(
      { _id: { $in: threadIds } },
      {
        $set: {
          ...updates,
          lastActivityAt: new Date()
        }
      }
    );

    return {
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} threads updated`
    };
  };

  // Get related threads
  schema.statics.getRelatedThreads = async function(threadId, limit = 5) {
    const thread = await this.findById(threadId);
    if (!thread) return [];

    const relatedThreads = await this.find({
      _id: { $ne: threadId },
      isDeleted: false,
      $or: [
        { category: thread.category },
        { tags: { $in: thread.tags || [] } }
      ]
    })
      .populate('author', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return relatedThreads.map(t => formatThreadResponse(t));
  };
};