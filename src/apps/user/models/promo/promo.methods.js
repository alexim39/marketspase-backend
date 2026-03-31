import { PromoClaimModel } from "./promoClaim/promoClaim.model.js";

export const setupPromoMethods = (schema) => {
  // Check if promo is active and available
  schema.methods.isActive = function() {
    const now = new Date();
    return this.status === 'active' && 
           (!this.startDate || this.startDate <= now) && 
           (!this.endDate || this.endDate >= now);
  };

  // Check if user is eligible for this promo
  schema.methods.isUserEligible = async function(user) {
    if (!this.isActive()) {
      return { eligible: false, reason: 'Promo is not active' };
    }

    if (this.claimedSlots >= this.totalSlots) {
      return { eligible: false, reason: 'All slots have been claimed' };
    }

    if (this.targetRoles.length > 0 && !this.targetRoles.includes(user.role)) {
      return { eligible: false, reason: 'User role not eligible' };
    }

    if (this.eligibilityCriteria.minRating > 0 && user.rating < this.eligibilityCriteria.minRating) {
      return { eligible: false, reason: 'Minimum rating requirement not met' };
    }

    if (this.eligibilityCriteria.requireVerification && !user.isVerified) {
      return { eligible: false, reason: 'Account verification required' };
    }

    if (this.eligibilityCriteria.allowedCountries.length > 0 && user.personalInfo?.address?.country) {
      if (!this.eligibilityCriteria.allowedCountries.includes(user.personalInfo.address.country)) {
        return { eligible: false, reason: 'Country not eligible' };
      }
    }

    if (this.eligibilityCriteria.excludedUsers.includes(user._id)) {
      return { eligible: false, reason: 'User excluded from this promo' };
    }

    // Check if user has already claimed this promo
    const existingClaim = await PromoClaimModel.findOne({ 
      userId: user._id, 
      promoId: this._id 
    });

    if (existingClaim) {
      return { eligible: false, reason: 'You have already claimed this promotional offer' };
    }

    // Check max claims per user
    const userClaimCount = await PromoClaimModel.countDocuments({ 
      userId: user._id, 
      promoId: this._id 
    });

    if (userClaimCount >= this.eligibilityCriteria.maxClaimsPerUser) {
      return { eligible: false, reason: 'Maximum claims reached' };
    }

    return { eligible: true };
  };

  // Get remaining slots
  schema.methods.getRemainingSlots = function() {
    return Math.max(0, this.totalSlots - this.claimedSlots);
  };

  // Get remaining slots percentage
  schema.methods.getRemainingSlotsPercentage = function() {
    return (this.getRemainingSlots() / this.totalSlots) * 100;
  };
};