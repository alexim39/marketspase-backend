import { UserModel } from '../../user/models/user/index.js';
import { ThreadModel } from '../models/thread/index.js';
import { shapeForumThread } from '../services/forum-social.service.js';

export const toggleThreadLike = async (req, res) => {
  try {
    const { threadId } = req.body;
    const userId = req.userId || req.user?._id?.toString?.();

    if (!threadId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Thread ID is required',
      });
    }

    const [thread, user] = await Promise.all([
      ThreadModel.findById(threadId),
      UserModel.findById(userId).select('forumActivity.likedThreads'),
    ]);

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found',
      });
    }

    const alreadyLiked = (user?.forumActivity?.likedThreads || []).some((entry) => entry?.toString?.() === threadId);

    await Promise.all([
      ThreadModel.updateOne(
        { _id: threadId },
        alreadyLiked
          ? { $inc: { likeCount: -1 }, $pull: { likedBy: userId } }
          : { $inc: { likeCount: 1 }, $addToSet: { likedBy: userId } },
      ),
      UserModel.updateOne(
        { _id: userId },
        alreadyLiked
          ? { $pull: { 'forumActivity.likedThreads': threadId } }
          : { $addToSet: { 'forumActivity.likedThreads': threadId } },
      ),
    ]);

    const updatedThread = await ThreadModel.findById(threadId)
      .populate('author', 'displayName username avatar role badgeProfile gamificationProfile')
      .lean();

    return res.status(200).json({
      success: true,
      data: shapeForumThread(updatedThread, userId),
      liked: !alreadyLiked,
      message: alreadyLiked ? 'Thread unliked successfully' : 'Thread liked successfully',
    });
  } catch (error) {
    console.error('Error toggling thread like:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle thread like',
      error: error.message,
    });
  }
};
