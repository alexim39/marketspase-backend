import { FeedPostModel } from '../models/feed.model.js';
import { UserModel } from '../../user/models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Update a feed post
export const updateFeedPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { userId, content, hashtags } = req.body;

  // Find the post
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
    throw new ApiError(403, 'You are not authorized to edit this post');
  }

  // Update fields (only allowed ones)
  if (content !== undefined) {
    post.content = content;
  }
  if (hashtags !== undefined) {
    post.hashtags = hashtags.map(tag => ({ tag: tag.toLowerCase() }));
  }

  // Optionally update `updatedAt` automatically via pre-save hook
  await post.save();

  // Return the updated post with populated author
  const updatedPost = await FeedPostModel.findById(postId)
    .populate({
      path: 'author',
      select: 'username displayName avatar role rating badge'
    })
    .populate('campaign.campaignId', 'name budget status')
    .populate('earnings.campaignId', 'name')
    .lean();

  // Add interaction flags (if needed, similar to getFeedPosts)
  if (userId) {
    updatedPost.isLiked = updatedPost.likes?.some(like => 
      like.user?.toString() === userId.toString()
    ) || false;
    updatedPost.isSaved = updatedPost.savedBy?.some(saved => 
      saved.user?.toString() === userId.toString()
    ) || false;
    delete updatedPost.likes;
    delete updatedPost.savedBy;
  }

  return res.status(200).json(
    new ApiResponse(200, updatedPost, 'Post updated successfully')
  );
});