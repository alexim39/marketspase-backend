import { FeedPostModel } from '../models/feed/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { GetTrendingHashtagsDto } from '../application/dto/get-trending-hashtags.dto.js';
import { GetTrendingHashtagsUseCase } from '../application/use-cases/get-trending-hashtags.use-case.js';
import { MongooseFeedTrendingGateway } from '../infrastructure/gateways/mongoose-feed-trending.gateway.js';

const isFeedsDddEnabled = () => process.env.FEEDS_DDD_ENABLED !== 'false';
const feedTrendingGateway = new MongooseFeedTrendingGateway();
const getTrendingHashtagsUseCase = new GetTrendingHashtagsUseCase({ feedTrendingGateway });

// Get trending hashtags
export const getTrendingHashtags = asyncHandler(async (req, res) => {
  if (isFeedsDddEnabled()) {
    const response = await getTrendingHashtagsUseCase.execute(GetTrendingHashtagsDto.fromRequest());
    return res.status(response.statusCode).json(response.body);
  }

  const hashtags = await FeedPostModel.aggregate([
    { $unwind: '$hashtags' },
    { $match: { status: 'published' } },
    { $group: {
      _id: '$hashtags.tag',
      count: { $sum: 1 },
      posts: { $push: '$_id' }
    }},
    { $sort: { count: -1 } },
    { $limit: 20 },
    { $project: {
      tag: '$_id',
      count: 1,
      posts: { $slice: ['$posts', 3] }
    }}
  ]);

  return res.status(200).json(
    new ApiResponse(200, hashtags, 'Trending hashtags fetched')
  );
});
