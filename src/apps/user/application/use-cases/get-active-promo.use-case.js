import { GetActivePromoDto } from '../dto/get-active-promo.dto.js';

export class GetActivePromoUseCase {
  constructor({ promoOfferGateway } = {}) {
    if (!promoOfferGateway) {
      throw new Error('promoOfferGateway is required');
    }

    this.promoOfferGateway = promoOfferGateway;
  }

  async execute(input) {
    const dto = input instanceof GetActivePromoDto
      ? input
      : new GetActivePromoDto(input);

    const activePromos = await this.promoOfferGateway.findActivePromosForRole(dto.role);

    if (activePromos.length === 0) {
      return {
        statusCode: 200,
        body: {
          success: true,
          data: null,
          message: 'No active promotions found',
        },
      };
    }

    const promo = activePromos[0];
    const promoWithSlots = await this.promoOfferGateway.getPromoWithSlots(promo._id);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: promoWithSlots,
      },
    };
  }
}
