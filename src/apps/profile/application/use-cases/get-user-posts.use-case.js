import { GetUserPostsDto } from '../dto/profile-social-query.dto.js';

export class GetUserPostsUseCase {
  constructor({ profileSocialGateway } = {}) {
    if (!profileSocialGateway) {
      throw new Error('profileSocialGateway is required');
    }

    this.profileSocialGateway = profileSocialGateway;
  }

  async execute(input) {
    const dto = input instanceof GetUserPostsDto ? input : new GetUserPostsDto(input);
    const { posts, total } = await this.profileSocialGateway.listUserPosts({
      userId: dto.userId,
      page: dto.page,
      limit: dto.limit,
      pageNumber: dto.pageNumber,
      limitNumber: dto.limitNumber,
      skip: dto.skip,
      currentViewerId: dto.currentViewerId,
    });

    return {
      statusCode: 200,
      body: {
        posts,
        total,
        page: dto.pageNumber,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }
}
