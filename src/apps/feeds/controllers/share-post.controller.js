import { FeedPostModel } from '../models/feed/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Share post counter
export const sharePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { platform, userId } = req.body;

  // console.log('share postId ', postId)
  // console.log('share body ', userId)

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  post.shares.push({ user: userId, platform, sharedAt: new Date() });
  await post.save();

  return res.status(200).json(
    new ApiResponse(200, { shareCount: post.shares.length }, 'Post shared successfully')
  );
});