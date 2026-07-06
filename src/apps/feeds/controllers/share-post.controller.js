import { FeedPostModel } from '../models/feed/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { autoTrackContractEngagement } from '../../social/services/auto-track-engagement.service.js';

// Share post counter
export const sharePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { platform = 'copy' } = req.body;
  const userId = req.userId;

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  post.shares.push({ user: userId, platform, sharedAt: new Date() });
  post.socialMetrics = post.socialMetrics || {};
  post.socialMetrics.externalShares = (post.socialMetrics.externalShares || 0) + 1;
  await post.save();

  // Auto-track toward active engagement contracts
  if (post.author) {
    await autoTrackContractEngagement(userId, post.author.toString(), 'share');
  }

  return res.status(200).json(
    new ApiResponse(200, { shareCount: post.shares.length }, 'Post shared successfully')
  );
});
