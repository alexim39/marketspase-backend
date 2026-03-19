import { UserModel } from '../../user/models/user/index.js';
import { ThreadModel } from './../models/thread.model.js';


/**
 * @desc    Toggle like on a thread
 * @route   PUT /api/forum/threads/:threadId/like
 * @access  Private
 */
export const toggleThreadLike = async (req, res) => {
  try {
    const { threadId, userId } = req.body;

    console.log('Toggling like for thread:', threadId, 'by user:', userId);

    if (!threadId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Thread ID and User ID are required'
      });
    }

    // 1. Validate the thread exists
    const thread = await ThreadModel.findById(threadId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // 2. Check if user already liked the thread
    const user = await UserModel.findById(userId);
    const alreadyLiked = user.forumActivity.likedThreads.includes(threadId);

    let updatedThread;
    let updatedUser;

    if (alreadyLiked) {
      // 3a. Remove like
      updatedThread = await ThreadModel.findByIdAndUpdate(
        threadId,
        {
          $inc: { likeCount: -1 },
          $pull: { likedBy: userId }
        },
        { new: true }
      )
      .populate('author', 'displayName username avatar')
      .select('-__v'); // Exclude version key

      updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        {
          $pull: { 'forumActivity.likedThreads': threadId }
        },
        { new: true }
      );
    } else {
      // 3b. Add like
      updatedThread = await ThreadModel.findByIdAndUpdate(
        threadId,
        {
          $inc: { likeCount: 1 },
          $addToSet: { likedBy: userId }
        },
        { new: true }
      )
      .populate('author', 'displayName username avatar')
      .select('-__v'); // Exclude version key

      updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        {
          $addToSet: { 'forumActivity.likedThreads': threadId }
        },
        { new: true }
      );
    }

    // 4. Get updated like count
    const likeCount = updatedThread.likeCount;

    res.status(200).json({
      success: true,
      data: {
        thread: updatedThread,
        likeCount,
        isLiked: !alreadyLiked
      },
      message: alreadyLiked ? 'Thread unliked successfully' : 'Thread liked successfully'
    });

  } catch (error) {
    console.error('Error toggling thread like:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle thread like',
      error: error.message
    });
  }
};
