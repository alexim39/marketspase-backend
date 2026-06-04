import { FeedPostModel } from '../models/feed/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { TrackPostChatClickDto } from '../application/dto/track-post-chat-click.dto.js';
import { TrackPostChatClickUseCase } from '../application/use-cases/track-post-chat-click.use-case.js';
import { MongooseFeedChatClickGateway } from '../infrastructure/gateways/mongoose-feed-chat-click.gateway.js';

const isFeedsDddEnabled = () => process.env.FEEDS_DDD_ENABLED !== 'false';
const feedChatClickGateway = new MongooseFeedChatClickGateway();
const trackPostChatClickUseCase = new TrackPostChatClickUseCase({
  feedChatClickGateway,
});

export const trackPostChatClick = asyncHandler(async (req, res) => {
  if (isFeedsDddEnabled()) {
    const response = await trackPostChatClickUseCase.execute(
      TrackPostChatClickDto.fromRequest({
        params: req.params || {},
      }),
    );

    if (response.errorMessage) {
      throw new ApiError(response.statusCode, response.errorMessage);
    }

    return res.status(response.statusCode).json(response.body);
  }

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
