import { GetActiveUsersDto } from '../dto/forum-stats-query.dto.js';
import { mapForumContributorSpotlight } from '../mappers/forum-stats.mapper.js';

export class GetActiveUsersUseCase {
  constructor({ forumStatsGateway } = {}) {
    if (!forumStatsGateway) {
      throw new Error('forumStatsGateway is required');
    }

    this.forumStatsGateway = forumStatsGateway;
  }

  async execute(input) {
    const dto = input instanceof GetActiveUsersDto
      ? input
      : new GetActiveUsersDto(input);
    const spotlight = await this.forumStatsGateway.getContributorSpotlight({
      limit: dto.limit,
      timeframeDays: dto.timeframeDays,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: spotlight.map(mapForumContributorSpotlight),
        timeframe: dto.timeframe,
      },
    };
  }
}
