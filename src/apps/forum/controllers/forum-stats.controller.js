import { UserModel } from '../../user/models/user/index.js';
import { CommentModel } from '../models/comment/index.js';
import { ThreadModel } from '../models/thread/index.js';
import {
  getForumContributorSpotlight,
  getForumHotTopics,
  getForumThreadHighlights,
  shapeForumThread,
} from '../services/forum-social.service.js';

const getViewerId = (req) => req.userId || req.user?._id?.toString?.() || null;
const clampLimit = (value, fallback = 5) => Math.max(1, Math.min(20, Number(value || fallback)));

export const getCommunityStats = async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalMembers, totalDiscussions, totalComments, todayDiscussions, todayComments] = await Promise.all([
      UserModel.countDocuments({ isActive: true, isDeleted: false }),
      ThreadModel.countDocuments({ isDeleted: { $ne: true } }),
      CommentModel.countDocuments({ isDeleted: { $ne: true } }),
      ThreadModel.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: today } }),
      CommentModel.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: today } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalMembers,
        totalDiscussions,
        totalComments,
        todayDiscussions,
        todayComments,
        todayActivity: todayDiscussions + todayComments,
      },
    });
  } catch (error) {
    console.error('Error fetching community stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch community statistics',
      error: error.message,
    });
  }
};

export const getPinnedThreads = async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 5);
    const viewerId = getViewerId(req);

    const threads = await ThreadModel.find({
      isPinned: true,
      isDeleted: { $ne: true },
    })
      .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
      .sort({ pinOrder: 1, pinnedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: threads.map((thread) => ({
        ...shapeForumThread(thread, viewerId),
        url: `/dashboard/community/discussion/${thread._id}`,
      })),
      count: threads.length,
    });
  } catch (error) {
    console.error('Error fetching pinned threads:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pinned threads',
      error: error.message,
    });
  }
};

export const getTrendingThreads = async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 5);
    const timeframe = req.query.timeframe || 'week';
    const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'month' ? 30 : 7;
    const viewerId = getViewerId(req);

    const threads = await getForumThreadHighlights({
      limit,
      timeframeDays,
      userId: viewerId,
    });

    return res.status(200).json({
      success: true,
      data: threads.map((thread) => ({
        ...thread,
        activityCount: thread.trendingScore || thread.engagementScore || 0,
        stats: {
          views: thread.viewCount || 0,
          likes: thread.likeCount || 0,
          comments: thread.commentCount || 0,
        },
      })),
      timeframe,
    });
  } catch (error) {
    console.error('Error fetching trending threads:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch trending threads',
      error: error.message,
    });
  }
};

export const getActiveUsers = async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 5);
    const timeframe = req.query.timeframe || 'month';
    const timeframeDays = timeframe === 'week' ? 7 : timeframe === 'all' ? 3650 : 30;
    const spotlight = await getForumContributorSpotlight({ limit, timeframeDays });

    return res.status(200).json({
      success: true,
      data: spotlight.map((entry) => ({
        id: entry._id,
        name: entry.displayName,
        initials: getInitials(entry.displayName || entry.username),
        avatar: entry.avatar,
        avatarColor: getAvatarColor(entry._id),
        postCount: entry.threadCount,
        commentCount: entry.commentCount,
        totalLikes: entry.engagementPoints,
        role: entry.role,
        badge: entry.badge,
      })),
      timeframe,
    });
  } catch (error) {
    console.error('Error fetching active users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active users',
      error: error.message,
    });
  }
};

export const getPopularTags = async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 10);
    const timeframe = req.query.timeframe || 'month';
    const timeframeDays = timeframe === 'week' ? 7 : timeframe === 'all' ? 3650 : 30;
    const hotTopics = await getForumHotTopics({ limit, timeframeDays });

    return res.status(200).json({
      success: true,
      data: hotTopics.map((topic) => topic.topic),
      details: hotTopics,
    });
  } catch (error) {
    console.error('Error fetching popular tags:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch popular tags',
      error: error.message,
    });
  }
};

export const getHotTopics = async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 8);
    const timeframe = req.query.timeframe || 'week';
    const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'month' ? 30 : 7;
    const topics = await getForumHotTopics({ limit, timeframeDays });

    return res.status(200).json({
      success: true,
      data: topics,
      timeframe,
    });
  } catch (error) {
    console.error('Error fetching hot topics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch hot topics',
      error: error.message,
    });
  }
};

function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(userId) {
  const colors = [
    '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336',
    '#00BCD4', '#E91E63', '#3F51B5', '#009688', '#FF5722',
  ];

  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(index);
    hash &= hash;
  }

  return colors[Math.abs(hash) % colors.length];
}
