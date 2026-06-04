import { GetPopularTagsDto } from '../dto/forum-stats-query.dto.js';

export class GetPopularTagsUseCase {
  constructor({ forumStatsGateway } = {}) {
    if (!forumStatsGateway) {
      throw new Error('forumStatsGateway is required');
    }

    this.forumStatsGateway = forumStatsGateway;
  }

  async execute(input) {
    const dto = input instanceof GetPopularTagsDto
      ? input
      : new GetPopularTagsDto(input);
    const hotTopics = await this.forumStatsGateway.getHotTopics({
      limit: dto.limit,
      timeframeDays: dto.timeframeDays,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: hotTopics.map((topic) => topic.topic),
        details: hotTopics,
      },
    };
  }
}
