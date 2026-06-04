import { ValidateReferralCodeDto } from '../dto/referral-query.dto.js';

export class ValidateReferralCodeUseCase {
  constructor({ referralGateway } = {}) {
    if (!referralGateway) {
      throw new Error('referralGateway is required');
    }

    this.referralGateway = referralGateway;
  }

  async execute(input) {
    const dto = input instanceof ValidateReferralCodeDto ? input : new ValidateReferralCodeDto(input);
    const user = await this.referralGateway.findReferralCodeOwner(dto.referralCode);

    if (!user) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'Invalid referral code',
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          valid: true,
          referrerName: user.displayName,
          referrerUsername: user.username,
        },
      },
    };
  }
}
