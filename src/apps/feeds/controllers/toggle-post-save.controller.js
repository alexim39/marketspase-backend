import { FeedPostModel } from '../models/feed/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';


// Save/Unsave post
export const toggleSavePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.userId;

  // console.log('save postId ', postId)
  // console.log('save body ', userId)

  const post = await FeedPostModel.findById(postId);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const savedIndex = post.savedBy.findIndex(saved => 
    saved.user?.toString() === userId?.toString()
  );

  if (savedIndex === -1) {
    post.savedBy.push({ user: userId, savedAt: new Date() });
  } else {
    post.savedBy.splice(savedIndex, 1);
  }

  await post.save();

  return res.status(200).json(
    new ApiResponse(200, { 
      saved: savedIndex === -1,
      saveCount: post.savedBy.length 
    }, savedIndex === -1 ? 'Post saved' : 'Post unsaved')
  );
});
