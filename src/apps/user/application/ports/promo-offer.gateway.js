export class PromoOfferGateway {
  async findActivePromosForRole(_role) {
    throw new Error('PromoOfferGateway.findActivePromosForRole must be implemented');
  }

  async getPromoWithSlots(_promoId) {
    throw new Error('PromoOfferGateway.getPromoWithSlots must be implemented');
  }

  async findPromoById(_promoId) {
    throw new Error('PromoOfferGateway.findPromoById must be implemented');
  }

  async findUserById(_userId) {
    throw new Error('PromoOfferGateway.findUserById must be implemented');
  }

  async checkUserEligibility(_command = {}) {
    throw new Error('PromoOfferGateway.checkUserEligibility must be implemented');
  }

  async createPromoClaim(_command = {}) {
    throw new Error('PromoOfferGateway.createPromoClaim must be implemented');
  }

  async incrementClaimedSlots(_promoId) {
    throw new Error('PromoOfferGateway.incrementClaimedSlots must be implemented');
  }

  async creditUserWallet(_command = {}) {
    throw new Error('PromoOfferGateway.creditUserWallet must be implemented');
  }

  async appendUserWalletTransaction(_command = {}) {
    throw new Error('PromoOfferGateway.appendUserWalletTransaction must be implemented');
  }

  async markPromoClaimCredited(_command = {}) {
    throw new Error('PromoOfferGateway.markPromoClaimCredited must be implemented');
  }

  async recordPromoCreditActivity(_command = {}) {
    throw new Error('PromoOfferGateway.recordPromoCreditActivity must be implemented');
  }

  async findPromoClaimsForUser(_userId) {
    throw new Error('PromoOfferGateway.findPromoClaimsForUser must be implemented');
  }
}
