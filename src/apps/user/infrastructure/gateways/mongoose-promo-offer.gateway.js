import { PromoOfferGateway } from '../../application/ports/promo-offer.gateway.js';
import { PromoClaimModel, PromoModel } from '../../models/promo/index.js';
import { UserModel } from '../../models/user/index.js';

export class MongoosePromoOfferGateway extends PromoOfferGateway {
  constructor({
    promoModel = PromoModel,
    promoClaimModel = PromoClaimModel,
    userModel = UserModel,
  } = {}) {
    super();
    this.promoModel = promoModel;
    this.promoClaimModel = promoClaimModel;
    this.userModel = userModel;
  }

  async findActivePromosForRole(role) {
    return this.promoModel.findActivePromosForRole(role);
  }

  async getPromoWithSlots(promoId) {
    return this.promoModel.getPromoWithSlots(promoId);
  }

  async findPromoById(promoId) {
    return this.promoModel.findById(promoId);
  }

  async findUserById(userId) {
    return this.userModel.findById(userId);
  }

  async checkUserEligibility({ promo, user } = {}) {
    return promo.isUserEligible(user);
  }

  async createPromoClaim({ userId, promoId, creditAmount } = {}) {
    const promoClaim = new this.promoClaimModel({
      userId,
      promoId,
      creditAmount,
    });

    return promoClaim.save();
  }

  async incrementClaimedSlots(promoId) {
    return this.promoModel.findByIdAndUpdate(promoId, {
      $inc: { claimedSlots: 1 },
    });
  }

  async creditUserWallet({ userId, role, amount } = {}) {
    const walletField = `wallets.${role}.balance`;

    return this.userModel.findByIdAndUpdate(userId, {
      $inc: { [walletField]: amount },
    });
  }

  async appendUserWalletTransaction({ userId, role, transaction } = {}) {
    return this.userModel.findByIdAndUpdate(userId, {
      $push: {
        [`wallets.${role}.transactions`]: transaction,
      },
    });
  }

  async markPromoClaimCredited({ promoClaim, creditedAt } = {}) {
    promoClaim.status = 'credited';
    promoClaim.creditedAt = creditedAt;
    return promoClaim.save();
  }

  async recordPromoCreditActivity({ user, promo } = {}) {
    return user.logActivity(
      'promo_credit_claimed',
      `Claimed promotional credit of \u20a6${promo.creditAmount}`,
      {
        resourceType: 'bonus',
        resourceId: promo._id,
        metadata: {
          creditAmount: promo.creditAmount,
          promoName: promo.name,
        },
      },
    );
  }

  async findPromoClaimsForUser(userId) {
    return this.promoClaimModel.find({ userId })
      .populate('promoId', 'name code creditAmount')
      .sort({ createdAt: -1 });
  }
}
