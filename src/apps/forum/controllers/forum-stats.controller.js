import { UserModel } from '../../user/models/user/index.js';
import { ThreadModel } from '../models/thread/index.js';
import { CommentModel } from '../models/comment/index.js';

/**
 * @desc    Get community statistics
 * @route   GET /api/forum/stats
 * @access  Public
 */
export const getCommunityStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfDay = new Date(today);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all stats in parallel
    const [
      totalMembers,
      totalDiscussions,
      totalComments,
      todayDiscussions,
      todayComments
    ] = await Promise.all([
      // Total active members
      UserModel.countDocuments({ 
        isActive: true, 
        isDeleted: false 
      }),
      
      // Total discussions (threads)
      ThreadModel.countDocuments({ 
        isDeleted: false 
      }),
      
      // Total comments (including replies)
      CommentModel.countDocuments({ 
        isDeleted: false 
      }),
      
      // Today's discussions
      ThreadModel.countDocuments({
        isDeleted: false,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      
      // Today's comments
      CommentModel.countDocuments({
        isDeleted: false,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      })
    ]);

    // Calculate total activity for today
    const todayActivity = todayDiscussions + todayComments;

    res.status(200).json({
      success: true,
      data: {
        totalMembers,
        totalDiscussions,
        totalComments,
        todayDiscussions,
        todayComments,
        todayActivity
      }
    });

  } catch (error) {
    console.error('Error fetching community stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community statistics',
      error: error.message
    });
  }
};

/**
 * @desc    Get pinned threads
 * @route   GET /api/forum/threads/pinned
 * @access  Public
 */
export const getPinnedThreads = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const pinnedThreads = await ThreadModel.find({
      isPinned: true,
      isDeleted: false
    })
      .populate('author', 'displayName username avatar')
      .select('title commentCount createdAt author')
      .sort({ pinnedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    // Format the response
    const formattedThreads = pinnedThreads.map(thread => ({
      _id: thread._id,
      title: thread.title,
      replyCount: thread.commentCount || 0,
      author: thread.author,
      createdAt: thread.createdAt,
      url: `/forum/thread/${thread._id}`
    }));

    res.status(200).json({
      success: true,
      data: formattedThreads,
      count: formattedThreads.length
    });

  } catch (error) {
    console.error('Error fetching pinned threads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pinned threads',
      error: error.message
    });
  }
};

/**
 * @desc    Get trending threads based on activity score
 * @route   GET /api/forum/threads/trending
 * @access  Public
 */
export const getTrendingThreads = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const timeframe = req.query.timeframe || 'week'; // 'day', 'week', 'month'
    
    // Calculate date based on timeframe
    const date = new Date();
    switch (timeframe) {
      case 'day':
        date.setDate(date.getDate() - 1);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'week':
      default:
        date.setDate(date.getDate() - 7);
    }

    // Get threads with activity in the timeframe
    const trendingThreads = await ThreadModel.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: date }
        }
      },
      {
        $addFields: {
          // Calculate trending score based on engagement
          activityScore: {
            $add: [
              { $multiply: ['$viewCount', 1] },
              { $multiply: ['$likeCount', 3] },
              { $multiply: ['$commentCount', 5] }
            ]
          }
        }
      },
      {
        $sort: { activityScore: -1, createdAt: -1 }
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author'
        }
      },
      {
        $unwind: {
          path: '$author',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          tags: 1,
          viewCount: 1,
          likeCount: 1,
          commentCount: 1,
          activityScore: 1,
          createdAt: 1,
          'author.displayName': 1,
          'author.username': 1,
          'author.avatar': 1
        }
      }
    ]);

    // Format the response
    const formattedThreads = trendingThreads.map(thread => ({
      _id: thread._id,
      title: thread.title,
      tags: thread.tags || [],
      activityCount: thread.activityScore || 0,
      author: thread.author,
      createdAt: thread.createdAt,
      stats: {
        views: thread.viewCount || 0,
        likes: thread.likeCount || 0,
        comments: thread.commentCount || 0
      }
    }));

    res.status(200).json({
      success: true,
      data: formattedThreads,
      timeframe
    });

  } catch (error) {
    console.error('Error fetching trending threads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending threads',
      error: error.message
    });
  }
};

/**
 * @desc    Get active users (contributors)
 * @route   GET /api/forum/users/active
 * @access  Public
 */
export const getActiveUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const timeframe = req.query.timeframe || 'month'; // 'week', 'month', 'all'
    
    // Calculate date based on timeframe
    let dateFilter = {};
    if (timeframe !== 'all') {
      const date = new Date();
      if (timeframe === 'week') {
        date.setDate(date.getDate() - 7);
      } else if (timeframe === 'month') {
        date.setMonth(date.getMonth() - 1);
      }
      dateFilter = { createdAt: { $gte: date } };
    }

    // Aggregate user activity
    const activeUsers = await ThreadModel.aggregate([
      {
        $match: {
          isDeleted: false,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$author',
          threadCount: { $sum: 1 },
          totalLikesReceived: { $sum: '$likeCount' },
          totalCommentsReceived: { $sum: '$commentCount' },
          totalViews: { $sum: '$viewCount' },
          lastActive: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      {
        $unwind: '$userDetails'
      },
      {
        $match: {
          'userDetails.isActive': true,
          'userDetails.isDeleted': false
        }
      },
      {
        $addFields: {
          activityScore: {
            $add: [
              { $multiply: ['$threadCount', 10] },
              { $multiply: ['$totalLikesReceived', 2] },
              { $multiply: ['$totalCommentsReceived', 3] }
            ]
          }
        }
      },
      {
        $sort: { activityScore: -1, lastActive: -1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          _id: 1,
          displayName: '$userDetails.displayName',
          username: '$userDetails.username',
          avatar: '$userDetails.avatar',
          threadCount: 1,
          totalLikesReceived: 1,
          totalCommentsReceived: 1,
          activityScore: 1,
          lastActive: 1
        }
      }
    ]);

    // Also get comment activity for users who primarily comment
    const commentContributors = await CommentModel.aggregate([
      {
        $match: {
          isDeleted: false,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$author',
          commentCount: { $sum: 1 },
          totalLikesReceived: { $sum: '$likeCount' },
          lastActive: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      {
        $unwind: '$userDetails'
      },
      {
        $match: {
          'userDetails.isActive': true,
          'userDetails.isDeleted': false
        }
      },
      {
        $project: {
          _id: 1,
          displayName: '$userDetails.displayName',
          username: '$userDetails.username',
          avatar: '$userDetails.avatar',
          commentCount: 1,
          totalLikesReceived: 1,
          lastActive: 1
        }
      }
    ]);

    // Combine and format the results
    const userMap = new Map();

    // Add thread contributors
    activeUsers.forEach(user => {
      userMap.set(user._id.toString(), {
        id: user._id,
        name: user.displayName || user.username,
        initials: getInitials(user.displayName || user.username),
        avatar: user.avatar,
        avatarColor: getAvatarColor(user._id.toString()),
        postCount: user.threadCount || 0,
        commentCount: 0,
        totalLikes: user.totalLikesReceived || 0,
        activityScore: user.activityScore || 0
      });
    });

    // Add/update comment contributors
    commentContributors.forEach(user => {
      const userId = user._id.toString();
      if (userMap.has(userId)) {
        const existing = userMap.get(userId);
        existing.commentCount = user.commentCount || 0;
        existing.postCount += user.commentCount || 0;
        existing.totalLikes += user.totalLikesReceived || 0;
      } else {
        userMap.set(userId, {
          id: user._id,
          name: user.displayName || user.username,
          initials: getInitials(user.displayName || user.username),
          avatar: user.avatar,
          avatarColor: getAvatarColor(userId),
          postCount: user.commentCount || 0,
          commentCount: user.commentCount || 0,
          totalLikes: user.totalLikesReceived || 0,
          activityScore: user.commentCount * 5
        });
      }
    });

    // Convert to array, sort by activity, and limit
    const formattedUsers = Array.from(userMap.values())
      .sort((a, b) => {
        // Sort by combined activity
        const scoreA = a.postCount + a.totalLikes;
        const scoreB = b.postCount + b.totalLikes;
        return scoreB - scoreA;
      })
      .slice(0, limit);

    res.status(200).json({
      success: true,
      data: formattedUsers,
      timeframe
    });

  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active users',
      error: error.message
    });
  }
};

/**
 * @desc    Get popular tags
 * @route   GET /api/forum/tags/popular
 * @access  Public
 */
export const getPopularTags = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const timeframe = req.query.timeframe || 'month';
    
    // Calculate date based on timeframe
    const date = new Date();
    switch (timeframe) {
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'all':
        date.setFullYear(2000); // Beginning of time
        break;
    }

    // Aggregate tags from threads
    const popularTags = await ThreadModel.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: date },
          tags: { $exists: true, $ne: [] }
        }
      },
      {
        $unwind: '$tags'
      },
      {
        $group: {
          _id: { $toLower: '$tags' },
          count: { $sum: 1 },
          totalLikes: { $sum: '$likeCount' },
          totalComments: { $sum: '$commentCount' },
          totalViews: { $sum: '$viewCount' },
          lastUsed: { $max: '$createdAt' }
        }
      },
      {
        $addFields: {
          popularityScore: {
            $add: [
              { $multiply: ['$count', 10] },
              { $multiply: ['$totalLikes', 2] },
              { $multiply: ['$totalComments', 3] },
              '$totalViews'
            ]
          }
        }
      },
      {
        $sort: { popularityScore: -1, lastUsed: -1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          tag: '$_id',
          count: 1,
          totalLikes: 1,
          totalComments: 1,
          totalViews: 1,
          popularityScore: 1,
          lastUsed: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: popularTags.map(t => t.tag),
      details: popularTags
    });

  } catch (error) {
    console.error('Error fetching popular tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular tags',
      error: error.message
    });
  }
};

// Helper functions
function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(userId) {
  // Generate consistent color based on user ID
  const colors = [
    '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336',
    '#00BCD4', '#E91E63', '#3F51B5', '#009688', '#FF5722'
  ];
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  
  return colors[Math.abs(hash) % colors.length];
}