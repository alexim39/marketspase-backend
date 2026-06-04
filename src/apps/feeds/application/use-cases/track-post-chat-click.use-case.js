import { TrackPostChatClickDto } from '../dto/track-post-chat-click.dto.js';

export class TrackPostChatClickUseCase {
  constructor({ feedChatClickGateway } = {}) {
    if (!feedChatClickGateway) {
      throw new Error('feedChatClickGateway is required');
    }

    this.feedChatClickGateway = feedChatClickGateway;
  }

  async execute(input) {
    const dto = input instanceof TrackPostChatClickDto
      ? input
      : new TrackPostChatClickDto(input);

    const post = await this.feedChatClickGateway.trackChatClick(dto.postId);

    if (!post) {
      return {
        statusCode: 404,
        errorMessage: 'Post not found',
      };
    }

    const chatCount = post.socialMetrics?.chatClicks || post.socialMetrics?.externalClicks || 0;

    return {
      statusCode: 200,
      body: {
        statusCode: 200,
        data: { chatCount },
        message: 'WhatsApp click tracked successfully',
        success: true,
      },
    };
  }
}
