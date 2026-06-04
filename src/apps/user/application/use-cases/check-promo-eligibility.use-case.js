import { CheckPromoEligibilityDto } from '../dto/check-promo-eligibility.dto.js';

export class CheckPromoEligibilityUseCase {
  constructor({ promoOfferGateway } = {}) {
    if (!promoOfferGateway) {
      throw new Error('promoOfferGateway is required');
    }

    this.promoOfferGateway = promoOfferGateway;
  }

  async execute(input) {
    const dto = input instanceof CheckPromoEligibilityDto
      ? input
      : new CheckPromoEligibilityDto(input);

    const promo = await this.promoOfferGateway.findPromoById(dto.promoId);
    if (!promo) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'Promotional offer not found',
        },
      };
    }

    const user = await this.promoOfferGateway.findUserById(dto.userId);
    if (!user) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: 'User not found',
        },
      };
    }

    const eligibility = await this.promoOfferGateway.checkUserEligibility({
      promo,
      user,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: eligibility,
      },
    };
  }
}
