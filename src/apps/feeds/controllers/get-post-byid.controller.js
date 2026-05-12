import { FeedPostModel } from '../models/feed/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Get single post
export const getPostById = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.userId || null;

  const post = await FeedPostModel.findById(postId)
    .populate({
      path: 'author',
      select: 'username displayName avatar role rating badge'
    })
    .populate('campaign.campaignId', 'name budget status')
    .populate('earnings.campaignId', 'name')
    .populate('comments.user', 'username displayName avatar')
    .populate('comments.replies.user', 'username displayName avatar')
    .lean();

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Add user interaction data
  if (userId) {
    post.isLiked = post.likes?.some(like => 
      like.user?.toString() === userId.toString()
    ) || false;
    post.isSaved = post.savedBy?.some(saved => 
      saved.user?.toString() === userId.toString()
    ) || false;
    
    // Remove likes/saved arrays
    delete post.likes;
    delete post.savedBy;
  }

  // Track view
  const trackUpdate = { $inc: { 'reach.impressions': 1 } };
  if (userId) {
    trackUpdate.$addToSet = { 'reach.uniqueViews': userId };
  }
  await FeedPostModel.findByIdAndUpdate(postId, trackUpdate);

  return res.status(200).json(
    new ApiResponse(200, post, 'Post fetched successfully')
  );
});
