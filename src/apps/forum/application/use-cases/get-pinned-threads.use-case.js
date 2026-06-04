import { GetPinnedThreadsDto } from '../dto/forum-stats-query.dto.js';
import { mapForumPinnedThread } from '../mappers/forum-stats.mapper.js';

export class GetPinnedThreadsUseCase {
  constructor({ forumStatsGateway } = {}) {
    if (!forumStatsGateway) {
      throw new Error('forumStatsGateway is required');
    }

    this.forumStatsGateway = forumStatsGateway;
  }

  async execute(input) {
    const dto = input instanceof GetPinnedThreadsDto
      ? input
      : new GetPinnedThreadsDto(input);
    const threads = await this.forumStatsGateway.listPinnedThreads({
      limit: dto.limit,
      userId: dto.userId,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: threads.map(mapForumPinnedThread),
        count: threads.length,
      },
    };
  }
}
