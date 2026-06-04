import { FeedTrendingGateway } from '../../application/ports/feed-trending.gateway.js';
import { FeedPostModel } from '../../models/feed/index.js';

export class MongooseFeedTrendingGateway extends FeedTrendingGateway {
  constructor({ feedPostModel = FeedPostModel } = {}) {
    super();
    this.feedPostModel = feedPostModel;
  }

  async getTrendingHashtags({ limit = 20 } = {}) {
    return this.feedPostModel.aggregate([
      { $unwind: '$hashtags' },
      { $match: { status: 'published' } },
      {
        $group: {
          _id: '$hashtags.tag',
          count: { $sum: 1 },
          posts: { $push: '$_id' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          tag: '$_id',
          count: 1,
          posts: { $slice: ['$posts', 3] },
        },
      },
    ]);
  }
}
