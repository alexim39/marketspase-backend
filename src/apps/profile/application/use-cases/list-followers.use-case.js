import { ListFollowersDto } from '../dto/profile-social-query.dto.js';

export class ListFollowersUseCase {
  constructor({ profileSocialGateway } = {}) {
    if (!profileSocialGateway) {
      throw new Error('profileSocialGateway is required');
    }

    this.profileSocialGateway = profileSocialGateway;
  }

  async execute(input) {
    const dto = input instanceof ListFollowersDto ? input : new ListFollowersDto(input);
    const { followers, total } = await this.profileSocialGateway.listFollowers({
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
        followers,
        total,
        page: dto.pageNumber,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }
}
