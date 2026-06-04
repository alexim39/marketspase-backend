import { GetSuggestedUsersDto } from '../dto/profile-social-query.dto.js';

export class GetSuggestedUsersUseCase {
  constructor({ profileSocialGateway } = {}) {
    if (!profileSocialGateway) {
      throw new Error('profileSocialGateway is required');
    }

    this.profileSocialGateway = profileSocialGateway;
  }

  async execute(input) {
    const dto = input instanceof GetSuggestedUsersDto ? input : new GetSuggestedUsersDto(input);
    const users = await this.profileSocialGateway.listSuggestedUsers({
      userId: dto.userId,
      limit: dto.limitNumber,
    });

    return {
      statusCode: 200,
      body: users.map((user) => ({
        ...user,
        isFollowing: false,
      })),
    };
  }
}
