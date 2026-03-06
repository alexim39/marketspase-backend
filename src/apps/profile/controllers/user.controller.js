import { UserModel } from '../../user/models/user.model.js';
import { FollowModel } from '../models/follow.model.js';
import { FeedPostModel } from '../../feeds/models/feed.model.js';

// Get public profile of a user
export const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?._id; // from auth middleware

    const user = await UserModel.findById(userId)
      .select('uid username displayName avatar personalInfo.biography personalInfo.address.createdAt role rating ratingCount isVerified createdAt')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Get counts
    const [postsCount, followersCount, followingCount, totalLikes] = await Promise.all([
      FeedPostModel.countDocuments({ author: userId, status: 'published' }),
      FollowModel.countDocuments({ following: userId }),
      FollowModel.countDocuments({ follower: userId }),
      FeedPostModel.aggregate([
        { $match: { author: userId, status: 'published' } },
        { $project: { likesCount: { $size: '$likes' } } },
        { $group: { _id: null, total: { $sum: '$likesCount' } } },
      ]),
    ]);

    // Check if current user follows this profile
    let isFollowing = false;
    if (currentUserId && currentUserId.toString() !== userId) {
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
      totalLikes: totalLikes[0]?.total || 0,
      isFollowing,
      isOwnProfile: currentUserId?.toString() === userId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user's posts (paginated)
export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await FeedPostModel.find({ author: userId, status: 'published' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'displayName username avatar')
      .lean();

    const total = await FeedPostModel.countDocuments({ author: userId, status: 'published' });

    res.json({
      posts,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get followers list (paginated)
export const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
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
    const { page = 1, limit = 20 } = req.query;
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
    const currentUserId = req.user._id;

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