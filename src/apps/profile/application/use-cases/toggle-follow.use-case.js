import { ToggleFollowDto } from '../dto/profile-social-query.dto.js';

export class ToggleFollowUseCase {
  constructor({ profileSocialGateway } = {}) {
    if (!profileSocialGateway) {
      throw new Error('profileSocialGateway is required');
    }

    this.profileSocialGateway = profileSocialGateway;
  }

  async execute(input) {
    const dto = input instanceof ToggleFollowDto ? input : new ToggleFollowDto(input);

    if (!dto.currentUserId) {
      return {
        statusCode: 401,
        body: {
          message: 'Authentication required',
        },
      };
    }

    if (dto.currentUserId.toString() === dto.userId) {
      return {
        statusCode: 400,
        body: {
          message: 'You cannot follow yourself',
        },
      };
    }

    const existing = await this.profileSocialGateway.findFollow({
      follower: dto.currentUserId,
      following: dto.userId,
    });

    if (existing) {
      await this.profileSocialGateway.deleteFollow(existing);

      return {
        statusCode: 200,
        body: {
          followed: false,
        },
      };
    }

    await this.profileSocialGateway.createFollow({
      follower: dto.currentUserId,
      following: dto.userId,
    });

    return {
      statusCode: 200,
      body: {
        followed: true,
      },
    };
  }
}
