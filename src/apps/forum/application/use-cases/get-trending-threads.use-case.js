import { GetTrendingThreadsDto } from '../dto/forum-stats-query.dto.js';
import { mapForumTrendingThread } from '../mappers/forum-stats.mapper.js';

export class GetTrendingThreadsUseCase {
  constructor({ forumStatsGateway } = {}) {
    if (!forumStatsGateway) {
      throw new Error('forumStatsGateway is required');
    }

    this.forumStatsGateway = forumStatsGateway;
  }

  async execute(input) {
    const dto = input instanceof GetTrendingThreadsDto
      ? input
      : new GetTrendingThreadsDto(input);
    const threads = await this.forumStatsGateway.getThreadHighlights({
      limit: dto.limit,
      timeframeDays: dto.timeframeDays,
      userId: dto.userId,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: threads.map(mapForumTrendingThread),
        timeframe: dto.timeframe,
      },
    };
  }
}
