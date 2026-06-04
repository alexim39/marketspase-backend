import { GetTrendingHashtagsDto } from '../dto/get-trending-hashtags.dto.js';

export class GetTrendingHashtagsUseCase {
  constructor({ feedTrendingGateway } = {}) {
    if (!feedTrendingGateway) {
      throw new Error('feedTrendingGateway is required');
    }

    this.feedTrendingGateway = feedTrendingGateway;
  }

  async execute(input) {
    const dto = input instanceof GetTrendingHashtagsDto
      ? input
      : new GetTrendingHashtagsDto(input);

    const hashtags = await this.feedTrendingGateway.getTrendingHashtags({
      limit: dto.limit,
    });

    return {
      statusCode: 200,
      body: {
        statusCode: 200,
        data: hashtags,
        message: 'Trending hashtags fetched',
        success: true,
      },
    };
  }
}
