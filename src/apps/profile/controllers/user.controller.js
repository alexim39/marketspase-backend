import { UserModel } from '../../user/models/user/index.js';
import { FollowModel } from '../models/follow.model.js';
import { FeedPostModel } from '../../feeds/models/feed/index.js';
import mongoose from 'mongoose';

// Get public profile of a user
export const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentUserId } = req.query;

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await UserModel.findById(userId)
      .select('uid username displayName avatar personalInfo.biography personalInfo.address createdAt role rating ratingCount isVerified createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert to ObjectId for aggregation
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Run all counts in parallel
    const [postsCount, followersCount, followingCount, totalLikesResult] = await Promise.all([
      FeedPostModel.countDocuments({ author: userId, status: 'published' }),
      FollowModel.countDocuments({ following: userId }),
      FollowModel.countDocuments({ follower: userId }),
      FeedPostModel.aggregate([
        { $match: { author: userObjectId, status: 'published' } },
        { $project: { likesCount: { $size: '$likes' } } },
        { $group: { _id: null, total: { $sum: '$likesCount' } } },
      ]),
    ]);

    const totalLikes = totalLikesResult[0]?.total || 0;

    // Check if current user follows this profile
    let isFollowing = false;
    if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId) && currentUserId.toString() !== userId) {
      const follow = await FollowModel.findOne({
        follower: currentUserId,
        following: userId,
      });
      isFollowing = !!follow;
    }

    res.json({
      ...user,
      postsCount,
      followersCount,
      followingCount,
      totalLikes,
      isFollowing,
      isOwnProfile: currentUserId?.toString() === userId,
    });
  } catch (error) {
    console.error('Error in getProfile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user's posts (paginated)
export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, currentUserId } = req.query; // currentUserId from query
    const skip = (page - 1) * limit;

    const posts = await FeedPostModel.aggregate([
      { $match: { author: new mongoose.Types.ObjectId(userId), status: 'published' } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorDetails'
        }
      },
      { $unwind: '$authorDetails' },
      {
        $addFields: {
          likeCount: { $size: '$likes' },
          commentCount: { $size: '$comments' },
          shareCount: { $size: '$shares' },
          saveCount: { $size: '$savedBy' },
          isLikedByMe: currentUserId ? { $in: [mongoose.Types.ObjectId(currentUserId), '$likes.user'] } : false,
          isSavedByMe: currentUserId ? { $in: [mongoose.Types.ObjectId(currentUserId), '$savedBy.user'] } : false,
          author: {
            _id: '$authorDetails._id',
            displayName: '$authorDetails.displayName',
            username: '$authorDetails.username',
            avatar: '$authorDetails.avatar',
            role: '$authorDetails.role',
            badge: '$authorDetails.badge'
          }
        }
      },
      {
        $project: {
          likes: 0,
          comments: 0,
          shares: 0,
          savedBy: 0,
          authorDetails: 0
        }
      }
    ]);

    const total = await FeedPostModel.countDocuments({ author: userId, status: 'published' });

    res.json({
      posts,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get followers list (paginated)
export const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, currentUserId } = req.query;
    const skip = (page - 1) * limit;

    const followers = await FollowModel.find({ following: userId })
      .populate('follower', 'displayName username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await FollowModel.countDocuments({ following: userId });

    res.json({
      followers: followers.map(f => f.follower),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get following list (paginated)
export const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, currentUserId } = req.query;
    const skip = (page - 1) * limit;

    const following = await FollowModel.find({ follower: userId })
      .populate('following', 'displayName username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await FollowModel.countDocuments({ follower: userId });

    res.json({
      following: following.map(f => f.following),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle follow/unfollow
export const toggleFollow = async (req, res) => {
  try {
    const { userId } = req.params; // user to follow/unfollow
    const { currentUserId } = req.body;

    if (currentUserId.toString() === userId) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const existing = await FollowModel.findOne({
      follower: currentUserId,
      following: userId,
    });

    if (existing) {
      await existing.deleteOne();
      res.json({ followed: false });
    } else {
      await FollowModel.create({ follower: currentUserId, following: userId });
      res.json({ followed: true });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};