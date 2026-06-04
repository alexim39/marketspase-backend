import { canViewReferralProfile } from '../../domain/services/referral-access.policy.js';
import { GetReferralDetailsDto } from '../dto/referral-query.dto.js';

const toDateTime = (value) => new Date(value).getTime();

export class GetReferralDetailsUseCase {
  constructor({ referralGateway } = {}) {
    if (!referralGateway) {
      throw new Error('referralGateway is required');
    }

    this.referralGateway = referralGateway;
  }

  async execute(input) {
    const dto = input instanceof GetReferralDetailsDto ? input : new GetReferralDetailsDto(input);

    if (!dto.userId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'userId is required.',
        },
      };
    }

    const user = await this.referralGateway.findReferralUser(dto.userId);

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
          message: 'You are not allowed to view referral details for this user',
        },
      };
    }

    const allReferrals = Array.isArray(user.referralInfo?.referrals)
      ? [...user.referralInfo.referrals]
      : [];
    const referrals = allReferrals
      .sort((a, b) => toDateTime(b.createdAt) - toDateTime(a.createdAt))
      .slice(dto.skip, dto.skip + dto.limitNumber);
    const refereeIds = referrals
      .map((referral) => referral.refereeUserId)
      .filter(Boolean);
    const referees = await this.referralGateway.findUsersByIds(refereeIds);
    const refereeById = new Map(
      referees.map((referee) => [String(referee._id), referee]),
    );
    const referralDetails = referrals.map((referral) => ({
      ...referral,
      referee: refereeById.get(String(referral.refereeUserId)) || { username: 'Unknown User' },
    }));

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          referrals: referralDetails,
          total: allReferrals.length,
          page: dto.pageNumber,
          totalPages: Math.ceil(allReferrals.length / dto.limit),
        },
      },
    };
  }
}
