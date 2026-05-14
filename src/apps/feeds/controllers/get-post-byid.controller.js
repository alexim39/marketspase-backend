import { FeedPostModel } from '../models/feed/index.js';
import { getAuthorPopulation, shapeFeedPost } from '../services/feed-discovery.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Get single post
export const getPostById = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.userId || null;

  const post = await FeedPostModel.findById(postId)
    .populate(getAuthorPopulation())
    .populate('campaign.campaignId', 'title budget status link mediaUrl mediaType thumbnailUrl category')
    .populate('product.productId', 'name price originalPrice currency category images')
    .populate('product.storeId', 'name storeLink')
    .populate('earnings.campaignId', 'title')
    .populate('comments.user', 'username displayName avatar')
    .populate('comments.replies.user', 'username displayName avatar')
    .lean();

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Track view
  const trackUpdate = { $inc: { 'reach.impressions': 1 } };
  if (userId) {
    trackUpdate.$addToSet = { 'reach.uniqueViews': userId };
  }
  await FeedPostModel.findByIdAndUpdate(postId, trackUpdate);

  return res.status(200).json(
    new ApiResponse(200, shapeFeedPost(post, userId), 'Post fetched successfully')
  );
});
