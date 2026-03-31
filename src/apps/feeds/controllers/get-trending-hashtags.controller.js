import { FeedPostModel } from '../models/feed/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';


// Get trending hashtags
export const getTrendingHashtags = asyncHandler(async (req, res) => {
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