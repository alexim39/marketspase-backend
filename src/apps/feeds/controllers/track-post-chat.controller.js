import { FeedPostModel } from '../models/feed/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const trackPostChatClick = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await FeedPostModel.findByIdAndUpdate(
    postId,
    {
      $inc: {
        'socialMetrics.chatClicks': 1,
        'socialMetrics.externalClicks': 1
      }
    },
    {
      new: true,
      projection: { socialMetrics: 1 }
    }
  );

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const chatCount = post.socialMetrics?.chatClicks || post.socialMetrics?.externalClicks || 0;

  return res.status(200).json(
    new ApiResponse(200, { chatCount }, 'WhatsApp click tracked successfully')
  );
});
