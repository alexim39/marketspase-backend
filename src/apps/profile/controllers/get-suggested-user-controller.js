import { UserModel } from '../../user/models/user/index.js';
import { FollowModel } from '../models/follow/index.js';


export const getSuggestedUsers = async (req, res) => {
  try {
    const { userId, limit = 5 } = req.query;
    // Find users not followed by current user, excluding self
    const following = await FollowModel.find({ follower: userId }).distinct('following');
    const suggested = await UserModel.find({
      _id: { $ne: userId, $nin: following },
      isActive: true,
    })
      .limit(parseInt(limit))
      .select('displayName username avatar')
      .lean();

    // Optionally add isFollowing flag (always false here)
    res.json(suggested.map(u => ({ ...u, isFollowing: false })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};