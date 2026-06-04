import { canViewReferralProfile } from '../../domain/services/referral-access.policy.js';
import { GetReferralStatsDto } from '../dto/referral-query.dto.js';

export class GetReferralStatsUseCase {
  constructor({ referralGateway } = {}) {
    if (!referralGateway) {
      throw new Error('referralGateway is required');
    }

    this.referralGateway = referralGateway;
  }

  async execute(input) {
    const dto = input instanceof GetReferralStatsDto ? input : new GetReferralStatsDto(input);

    if (!dto.userId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'userId is required.',
        },
      };
    }

    const user = await this.referralGateway.findUserById(dto.userId);

    if (!user) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'User not found.',
        },
      };
    }

    if (!canViewReferralProfile({
      requestUserId: dto.requestUserId,
      requestUserRole: dto.requestUserRole,
      targetUserId: dto.userId,
    })) {
      return {
        statusCode: 403,
        body: {
          success: false,
          message: 'You are not allowed to view referral statistics for this user',
        },
      };
    }

    const stats = await this.referralGateway.getUserReferralStats(dto.userId);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: stats,
      },
    };
  }
}
