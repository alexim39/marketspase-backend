import { ListFollowingDto } from '../dto/profile-social-query.dto.js';

export class ListFollowingUseCase {
  constructor({ profileSocialGateway } = {}) {
    if (!profileSocialGateway) {
      throw new Error('profileSocialGateway is required');
    }

    this.profileSocialGateway = profileSocialGateway;
  }

  async execute(input) {
    const dto = input instanceof ListFollowingDto ? input : new ListFollowingDto(input);
    const { following, total } = await this.profileSocialGateway.listFollowing({
      userId: dto.userId,
      page: dto.page,
      limit: dto.limit,
      pageNumber: dto.pageNumber,
      limitNumber: dto.limitNumber,
      skip: dto.skip,
    });

    return {
      statusCode: 200,
      body: {
        following,
        total,
        page: dto.pageNumber,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }
}
