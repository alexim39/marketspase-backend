export class FeedListGateway {
  async findFeedPosts(_command = {}) {
    throw new Error('FeedListGateway.findFeedPosts must be implemented');
  }

  async countFeedPosts(_query = {}) {
    throw new Error('FeedListGateway.countFeedPosts must be implemented');
  }

  async trackFeedImpressions(_command = {}) {
    throw new Error('FeedListGateway.trackFeedImpressions must be implemented');
  }
}
