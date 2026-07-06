import { FeedPostModel } from '../models/feed/index.js';
import { FeedNotificationModel } from '../models/feed-notification/index.js';
import { UserModel } from '../../user/models/user/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { autoTrackContractEngagement } from '../../social/services/auto-track-engagement.service.js';

// Like/Unlike post
export const togglePostLike = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.userId;

  // console.log('like postId ', postId)
  // console.log('lik body ', userId)

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const likeIndex = post.likes.findIndex(like => 
    like.user.toString() === userId.toString()
  );

  if (likeIndex === -1) {
    // Like post
    post.likes.push({ user: userId });
    
    // Create notification for post author
    if (post?.author?.toString() !== userId?.toString()) {
      const user = await UserModel.findById(userId).select('displayName');
      await FeedNotificationModel.create({
        recipient: post.author,
        type: 'like',
        post: postId,
        actor: userId,
        message: `${user.displayName} liked your post`
      });
    }
  } else {
    // Unlike post
    post.likes.splice(likeIndex, 1);
  }

  await post.save();

  // Auto-track toward active engagement contracts
  if (likeIndex === -1 && post.author) {
    await autoTrackContractEngagement(userId, post.author.toString(), 'like');
  }

  return res.status(200).json(
    new ApiResponse(200, { 
      liked: likeIndex === -1,
      likeCount: post.likes.length 
    }, likeIndex === -1 ? 'Post liked' : 'Post unliked')
  );
});
