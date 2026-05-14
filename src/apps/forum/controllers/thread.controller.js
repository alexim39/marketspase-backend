import { UserModel } from '../../user/models/user/index.js';
import { CommentModel } from '../models/comment/index.js';
import { ThreadModel } from '../models/thread/index.js';
import {
  loadThreadComments,
  normalizePollPayload,
  normalizeStringList,
  shapeForumThread,
  toggleThreadFollowState,
  toggleTopicFollowState,
  voteOnThreadPoll,
} from '../services/forum-social.service.js';

const getViewerId = (req) => req.userId || req.user?._id?.toString?.() || null;
const isForumAdmin = (req) => ['admin', 'marketing_rep'].includes(req.user?.role) || ['admin', 'moderator'].includes(req.user?.type);

const buildThreadQuery = (req, viewer = null) => {
  const query = {
    isDeleted: { $ne: true },
  };

  if (req.query.category) {
    query.category = String(req.query.category).trim().toLowerCase();
  }

  if (req.query.tag) {
    const normalizedTag = String(req.query.tag).trim().toLowerCase();
    query.$or = [
      { tags: normalizedTag },
      { topicTags: normalizedTag },
      { category: normalizedTag },
    ];
  }

  if (req.query.topic) {
    query.topicTags = String(req.query.topic).trim().toLowerCase();
  }

  if (req.query.author) {
    query.author = req.query.author;
  }

  if (req.query.onlyPinned === 'true') {
    query.isPinned = true;
  }

  if (req.query.following === 'true') {
    query._id = {
      $in: viewer?.forumActivity?.followedThreads?.length
        ? viewer.forumActivity.followedThreads
        : [],
    };
  }

  if (req.query.search?.toString().trim()) {
    const regex = { $regex: req.query.search.toString().trim(), $options: 'i' };
    const searchConditions = [
      { title: regex },
      { content: regex },
      { tags: regex },
      { topicTags: regex },
      { 'poll.question': regex },
    ];

    if (Array.isArray(query.$or) && query.$or.length) {
      query.$and = [{ $or: query.$or }, { $or: searchConditions }];
      delete query.$or;
    } else {
      query.$or = searchConditions;
    }
  }

  return query;
};

const buildThreadSort = (sortBy = 'newest', sortOrder = 'desc') => {
  const direction = sortOrder === 'asc' ? 1 : -1;

  if (sortBy === 'oldest') {
    return { isPinned: -1, pinnedAt: -1, createdAt: 1 };
  }

  if (sortBy === 'most_liked' || sortBy === 'likeCount') {
    return { isPinned: -1, pinnedAt: -1, likeCount: -1, commentCount: -1, createdAt: -1 };
  }

  if (sortBy === 'most_commented' || sortBy === 'commentCount') {
    return { isPinned: -1, pinnedAt: -1, commentCount: -1, likeCount: -1, createdAt: -1 };
  }

  if (sortBy === 'most_viewed' || sortBy === 'viewCount') {
    return { isPinned: -1, pinnedAt: -1, viewCount: -1, createdAt: -1 };
  }

  if (sortBy === 'trending' || sortBy === 'trendingScore') {
    return { isPinned: -1, pinnedAt: -1, trendingScore: -1, lastActivityAt: -1, createdAt: -1 };
  }

  return { isPinned: -1, pinnedAt: -1, createdAt: direction };
};

const sanitizeUpdate = (payload = {}) => {
  const update = {};

  if (payload.title !== undefined) {
    update.title = String(payload.title).trim();
  }

  if (payload.content !== undefined) {
    update.content = String(payload.content).trim();
  }

  if (payload.tags !== undefined) {
    update.tags = normalizeStringList(payload.tags, { limit: 10, maxLength: 30 });
  }

  if (payload.topicTags !== undefined || payload.topics !== undefined) {
    update.topicTags = normalizeStringList(payload.topicTags || payload.topics, { limit: 8, maxLength: 32 });
  }

  if (payload.category !== undefined) {
    update.category = String(payload.category).trim().toLowerCase();
  }

  if (payload.status !== undefined) {
    update.status = String(payload.status).trim().toLowerCase();
  }

  if (payload.poll !== undefined) {
    update.poll = normalizePollPayload(payload.poll);
  }

  return update;
};

export const getThreads = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = clampLimit(parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;
    const viewerId = getViewerId(req);
    const viewer = viewerId
      ? await UserModel.findById(viewerId).select('forumActivity.followedThreads forumActivity.followedTopics').lean()
      : null;

    const query = buildThreadQuery(req, viewer);
    const sort = buildThreadSort(req.query.sortBy, req.query.sortOrder);

    const [totalThreads, threads] = await Promise.all([
      ThreadModel.countDocuments(query),
      ThreadModel.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      data: threads.map((thread) => shapeForumThread(thread, viewerId)),
      pagination: {
        page,
        limit,
        total: totalThreads,
        totalPages: Math.ceil(totalThreads / limit),
        hasMore: skip + threads.length < totalThreads,
      },
    });
  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch threads',
      error: error.message,
    });
  }
};

export const getThreadById = async (req, res) => {
  try {
    const viewerId = getViewerId(req);
    const threadId = req.params.id;

    const thread = await ThreadModel.findById(threadId)
      .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
      .lean();

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found',
      });
    }

    const comments = await loadThreadComments(threadId, viewerId);

    ThreadModel.findByIdAndUpdate(threadId, {
      $inc: { viewCount: 1 },
      $set: { lastActivityAt: new Date() },
    }).exec();

    return res.status(200).json({
      success: true,
      data: {
        ...shapeForumThread(thread, viewerId),
        comments,
      },
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch thread',
      error: error.message,
    });
  }
};

export const getThreadsByTags = async (req, res) => {
  req.query.tag = req.params.tags;
  return getThreads(req, res);
};

export const deleteThread = async (req, res) => {
  try {
    const threadId = req.params.threadId;
    const userId = getViewerId(req);

    if (!threadId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Thread ID is required',
      });
    }

    const thread = await ThreadModel.findById(threadId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found',
      });
    }

    if (thread.author?.toString() !== userId && !isForumAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this thread',
      });
    }

    await Promise.all([
      ThreadModel.deleteOne({ _id: threadId }),
      CommentModel.deleteMany({ thread: threadId }),
      UserModel.updateMany(
        {},
        {
          $pull: {
            'forumActivity.threads': threadId,
            'forumActivity.followedThreads': threadId,
            'forumActivity.likedThreads': threadId,
          },
        },
      ),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Thread deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting thread:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting thread',
      error: error.message,
    });
  }
};

export const updateThread = async (req, res) => {
  try {
    const threadId = req.params.threadId;
    const userId = getViewerId(req);

    if (!threadId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Thread ID is required',
      });
    }

    const thread = await ThreadModel.findById(threadId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found',
      });
    }

    if (thread.author?.toString() !== userId && !isForumAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'You are not the author of this thread',
      });
    }

    const update = sanitizeUpdate(req.body);
    Object.assign(thread, update);
    await thread.save();

    const populated = await ThreadModel.findById(threadId)
      .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
      .lean();

    return res.status(200).json({
      success: true,
      data: shapeForumThread(populated, userId),
    });
  } catch (error) {
    console.error('Error updating thread:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const searchThreads = async (req, res) => {
  if (req.query.q && !req.query.search) {
    req.query.search = req.query.q;
  }
  return getThreads(req, res);
};

export const getCategories = async (_req, res) => {
  try {
    const categories = await ThreadModel.aggregate([
      {
        $match: { isDeleted: { $ne: true } },
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalLikes: { $sum: '$likeCount' },
          totalComments: { $sum: '$commentCount' },
          followerCount: { $sum: '$followerCount' },
        },
      },
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $multiply: ['$count', 5] },
              { $multiply: ['$totalLikes', 2] },
              { $multiply: ['$totalComments', 3] },
              '$followerCount',
            ],
          },
        },
      },
      { $sort: { engagementScore: -1, count: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: categories.map((entry) => ({
        category: entry._id || 'discussion',
        count: entry.count,
        totalLikes: entry.totalLikes,
        totalComments: entry.totalComments,
        followerCount: entry.followerCount,
        engagementScore: entry.engagementScore,
      })),
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message,
    });
  }
};

export const toggleThreadFollow = async (req, res) => {
  try {
    const userId = getViewerId(req);
    const threadId = req.params.threadId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await toggleThreadFollowState(threadId, userId);
    return res.status(200).json({
      success: true,
      message: result.followed ? 'Thread followed' : 'Thread unfollowed',
      data: result,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Unable to update thread follow state',
    });
  }
};

export const toggleTopicFollow = async (req, res) => {
  try {
    const userId = getViewerId(req);
    const topic = req.params.topic || req.body.topic;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await toggleTopicFollowState(userId, topic);
    return res.status(200).json({
      success: true,
      message: result.followed ? 'Topic followed' : 'Topic unfollowed',
      data: result,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Unable to update topic follow state',
    });
  }
};

export const getMyForumFollows = async (req, res) => {
  try {
    const userId = getViewerId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const user = await UserModel.findById(userId)
      .select('forumActivity.followedTopics forumActivity.followedThreads')
      .populate({
        path: 'forumActivity.followedThreads',
        select: 'title author likeCount commentCount viewCount media mediaItems tags topicTags createdAt lastActivityAt isPinned pinnedAt followerCount trendingScore',
        populate: {
          path: 'author',
          select: 'displayName username avatar role badgeProfile gamificationProfile',
        },
      })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        followedTopics: user?.forumActivity?.followedTopics || [],
        followedThreads: (user?.forumActivity?.followedThreads || []).map((thread) => shapeForumThread(thread, userId)),
      },
    });
  } catch (error) {
    console.error('Error fetching forum follows:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch forum follows',
      error: error.message,
    });
  }
};

export const voteThreadPoll = async (req, res) => {
  try {
    const userId = getViewerId(req);
    const threadId = req.params.threadId;
    const optionIds = req.body.optionIds || req.body.optionId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const thread = await voteOnThreadPoll(threadId, userId, optionIds);
    return res.status(200).json({
      success: true,
      message: 'Poll vote recorded',
      data: thread,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to vote on poll',
    });
  }
};

const clampLimit = (value) => Math.max(1, Math.min(100, value || 20));
