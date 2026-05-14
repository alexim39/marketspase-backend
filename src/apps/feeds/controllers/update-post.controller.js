import { FeedPostModel } from '../models/feed/index.js';
import { UserModel } from '../../user/models/user/index.js';
import { getAuthorPopulation, shapeFeedPost } from '../services/feed-discovery.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Update a feed post
export const updateFeedPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content, hashtags, settings, challenge } = req.body;
  const userId = req.userId;

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
  if (settings !== undefined) {
    const parsedSettings = typeof settings === 'string' ? JSON.parse(settings) : settings;
    post.settings = {
      ...post.settings?.toObject?.(),
      ...parsedSettings
    };
  }
  if (challenge !== undefined) {
    const parsedChallenge = typeof challenge === 'string' ? JSON.parse(challenge) : challenge;
    post.challenge = parsedChallenge?.tag
      ? {
          ...post.challenge?.toObject?.(),
          ...parsedChallenge,
          tag: parsedChallenge.tag.toString().replace(/^#/, '').toLowerCase()
        }
      : undefined;
  }

  // Optionally update `updatedAt` automatically via pre-save hook
  await post.save();

  // Return the updated post with populated author
  const updatedPost = await FeedPostModel.findById(postId)
    .populate(getAuthorPopulation())
    .populate('campaign.campaignId', 'title budget status link mediaUrl mediaType thumbnailUrl category')
    .populate('product.productId', 'name price originalPrice currency category images')
    .populate('product.storeId', 'name storeLink')
    .populate('earnings.campaignId', 'title')
    .lean();

  return res.status(200).json(
    new ApiResponse(200, shapeFeedPost(updatedPost, userId), 'Post updated successfully')
  );
});
