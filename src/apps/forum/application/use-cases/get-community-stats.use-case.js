import { GetCommunityStatsDto } from '../dto/forum-stats-query.dto.js';

export class GetCommunityStatsUseCase {
  constructor({ forumStatsGateway } = {}) {
    if (!forumStatsGateway) {
      throw new Error('forumStatsGateway is required');
    }

    this.forumStatsGateway = forumStatsGateway;
  }

  async execute(input) {
    const dto = input instanceof GetCommunityStatsDto
      ? input
      : new GetCommunityStatsDto(input);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await this.forumStatsGateway.getCommunityStats({ today });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          totalMembers: stats.totalMembers,
          totalDiscussions: stats.totalDiscussions,
          totalComments: stats.totalComments,
          todayDiscussions: stats.todayDiscussions,
          todayComments: stats.todayComments,
          todayActivity: stats.todayDiscussions + stats.todayComments,
        },
      },
    };
  }
}
