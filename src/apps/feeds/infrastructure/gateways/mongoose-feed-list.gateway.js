import { FeedListGateway } from '../../application/ports/feed-list.gateway.js';
import { FeedPostModel } from '../../models/feed/index.js';
import { getAuthorPopulation } from '../../services/feed-discovery.service.js';

export class MongooseFeedListGateway extends FeedListGateway {
  constructor({ feedPostModel = FeedPostModel } = {}) {
    super();
    this.feedPostModel = feedPostModel;
  }

  async findFeedPosts({
    query,
    sortOptions,
    skip,
    limit,
  } = {}) {
    return this.feedPostModel.find(query)
      .populate(getAuthorPopulation())
      .populate('campaign.campaignId', 'title budget status link mediaUrl mediaType thumbnailUrl category')
      .populate('product.productId', 'name price originalPrice currency category images')
      .populate('product.storeId', 'name storeLink')
      .populate('earnings.campaignId', 'title')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async countFeedPosts(query = {}) {
    return this.feedPostModel.countDocuments(query);
  }

  async trackFeedImpressions({ posts = [], userId = null } = {}) {
    if (!Array.isArray(posts) || posts.length === 0) return;

    const now = new Date();
    const operations = posts
      .filter((post) => post?._id)
      .map((post) => {
        const update = {
          $inc: { 'reach.impressions': 1 },
          $set: { 'reach.lastImpressionAt': now },
        };

        if (userId) {
          update.$addToSet = { 'reach.uniqueViews': userId };
        }

        return {
          updateOne: {
            filter: { _id: post._id },
            update,
          },
        };
      });

    if (!operations.length) return;

    return this.feedPostModel.bulkWrite(operations, { ordered: false });
  }
}
