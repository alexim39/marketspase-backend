import { FeedCommentsGateway } from '../../application/ports/feed-comments.gateway.js';
import { FeedPostModel } from '../../models/feed/index.js';

export class MongooseFeedCommentsGateway extends FeedCommentsGateway {
  constructor({ feedPostModel = FeedPostModel } = {}) {
    super();
    this.feedPostModel = feedPostModel;
  }

  async findPostCommentsById(postId) {
    return this.feedPostModel.findById(postId)
      .select('comments')
      .populate('comments.user', 'displayName username avatar')
      .populate('comments.replies.user', 'displayName username avatar')
      .lean();
  }
}
