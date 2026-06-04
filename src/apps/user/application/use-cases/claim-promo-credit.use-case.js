import { ClaimPromoCreditDto } from '../dto/claim-promo-credit.dto.js';

export class ClaimPromoCreditUseCase {
  constructor({ promoOfferGateway, now = () => new Date() } = {}) {
    if (!promoOfferGateway) {
      throw new Error('promoOfferGateway is required');
    }

    this.promoOfferGateway = promoOfferGateway;
    this.now = now;
  }

  async execute(input) {
    const dto = input instanceof ClaimPromoCreditDto
      ? input
      : new ClaimPromoCreditDto(input);

    if (!dto.promoId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: 'Promo ID is required',
        },
      };
    }

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

    if (!eligibility.eligible) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: eligibility.reason || 'Not eligible for this promotion',
        },
      };
    }

    const promoClaim = await this.promoOfferGateway.createPromoClaim({
      userId: user._id,
      promoId: promo._id,
      creditAmount: promo.creditAmount,
    });

    await this.promoOfferGateway.incrementClaimedSlots(dto.promoId);

    if (promo.autoCredit) {
      await this.creditClaim({ promoClaim, user, promo });
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Promotional credit claimed successfully',
        data: {
          claimId: promoClaim._id,
          creditAmount: promo.creditAmount,
          status: promoClaim.status,
        },
      },
    };
  }

  async creditClaim({ promoClaim, user, promo }) {
    const createdAt = this.now();
    const transaction = {
      amount: promo.creditAmount,
      type: 'credit',
      category: 'bonus',
      description: `Promotional credit: ${promo.name}`,
      status: 'successful',
      createdAt,
    };

    await this.promoOfferGateway.creditUserWallet({
      userId: user._id,
      role: user.role,
      amount: promo.creditAmount,
    });

    await this.promoOfferGateway.appendUserWalletTransaction({
      userId: user._id,
      role: user.role,
      transaction,
    });

    await this.promoOfferGateway.markPromoClaimCredited({
      promoClaim,
      creditedAt: this.now(),
    });

    await this.promoOfferGateway.recordPromoCreditActivity({
      user,
      promo,
    });
  }
}
