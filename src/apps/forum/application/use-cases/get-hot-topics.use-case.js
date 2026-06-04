import { GetHotTopicsDto } from '../dto/forum-stats-query.dto.js';

export class GetHotTopicsUseCase {
  constructor({ forumStatsGateway } = {}) {
    if (!forumStatsGateway) {
      throw new Error('forumStatsGateway is required');
    }

    this.forumStatsGateway = forumStatsGateway;
  }

  async execute(input) {
    const dto = input instanceof GetHotTopicsDto
      ? input
      : new GetHotTopicsDto(input);
    const topics = await this.forumStatsGateway.getHotTopics({
      limit: dto.limit,
      timeframeDays: dto.timeframeDays,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: topics,
        timeframe: dto.timeframe,
      },
    };
  }
}
