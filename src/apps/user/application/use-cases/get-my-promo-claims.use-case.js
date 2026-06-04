import { GetMyPromoClaimsDto } from '../dto/get-my-promo-claims.dto.js';

export class GetMyPromoClaimsUseCase {
  constructor({ promoOfferGateway } = {}) {
    if (!promoOfferGateway) {
      throw new Error('promoOfferGateway is required');
    }

    this.promoOfferGateway = promoOfferGateway;
  }

  async execute(input) {
    const dto = input instanceof GetMyPromoClaimsDto
      ? input
      : new GetMyPromoClaimsDto(input);

    const claims = await this.promoOfferGateway.findPromoClaimsForUser(dto.userId);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: claims,
      },
    };
  }
}
