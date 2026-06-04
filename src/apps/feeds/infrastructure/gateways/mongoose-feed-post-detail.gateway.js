import { FeedPostDetailGateway } from '../../application/ports/feed-post-detail.gateway.js';
import { FeedPostModel } from '../../models/feed/index.js';
import { getAuthorPopulation } from '../../services/feed-discovery.service.js';

export class MongooseFeedPostDetailGateway extends FeedPostDetailGateway {
  constructor({ feedPostModel = FeedPostModel } = {}) {
    super();
    this.feedPostModel = feedPostModel;
  }

  async findPostById(postId) {
    return this.feedPostModel.findById(postId)
      .populate(getAuthorPopulation())
      .populate('campaign.campaignId', 'title budget status link mediaUrl mediaType thumbnailUrl category')
      .populate('product.productId', 'name price originalPrice currency category images')
      .populate('product.storeId', 'name storeLink')
      .populate('earnings.campaignId', 'title')
      .populate('comments.user', 'username displayName avatar')
      .populate('comments.replies.user', 'username displayName avatar')
      .lean();
  }

  async trackPostView({ postId, userId = null } = {}) {
    const trackUpdate = { $inc: { 'reach.impressions': 1 } };

    if (userId) {
      trackUpdate.$addToSet = { 'reach.uniqueViews': userId };
    }

    return this.feedPostModel.findByIdAndUpdate(postId, trackUpdate);
  }
}
