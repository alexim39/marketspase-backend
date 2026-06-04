import { FeedChatClickGateway } from '../../application/ports/feed-chat-click.gateway.js';
import { FeedPostModel } from '../../models/feed/index.js';

export class MongooseFeedChatClickGateway extends FeedChatClickGateway {
  constructor({ feedPostModel = FeedPostModel } = {}) {
    super();
    this.feedPostModel = feedPostModel;
  }

  async trackChatClick(postId) {
    return this.feedPostModel.findByIdAndUpdate(
      postId,
      {
        $inc: {
          'socialMetrics.chatClicks': 1,
          'socialMetrics.externalClicks': 1,
        },
      },
      {
        new: true,
        projection: { socialMetrics: 1 },
      },
    );
  }
}
