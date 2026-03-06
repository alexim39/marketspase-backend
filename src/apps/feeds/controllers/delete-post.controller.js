import { FeedPostModel } from '../models/feed.model.js';
import { FeedNotificationModel } from '../models/feed-notification.model.js';
import { UserModel } from '../../user/models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/* 
// Delete (archive) a feed post
export const deleteFeedPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.query;

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Check ownership or admin role
  const user = await UserModel.findById(userId).select('role');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isAuthor = post.author.toString() === userId.toString();
  const isAdmin = user.role === 'admin';

  if (!isAuthor && !isAdmin) {
    throw new ApiError(403, 'You are not authorized to delete this post');
  }

  // Soft delete: set status to 'archived'
  post.status = 'archived';
  await post.save();

  // Optional: remove related notifications
  // await FeedNotificationModel.deleteMany({ post: postId });

  return res.status(200).json(
    new ApiResponse(200, null, 'Post deleted successfully')
  );
}); */




// Permanently delete a feed post
export const deleteFeedPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.query;

  // Find the post first to verify ownership before deletion
  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Check ownership or admin role
  const user = await UserModel.findById(userId).select('role');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isAuthor = post.author.toString() === userId.toString();
  const isAdmin = user.role === 'admin';

  if (!isAuthor && !isAdmin) {
    throw new ApiError(403, 'You are not authorized to delete this post');
  }

  // Delete all notifications related to this post
  await FeedNotificationModel.deleteMany({ post: postId });

  // Permanently delete the post
  await FeedPostModel.findByIdAndDelete(postId);

  return res.status(200).json(
    new ApiResponse(200, null, 'Post permanently deleted successfully')
  );
});