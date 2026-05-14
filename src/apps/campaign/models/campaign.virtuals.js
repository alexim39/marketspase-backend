import { calculateRemainingDays, formatDuration, calculateDaysBetween } from "./campaign.utils.js";

export const setupCampaignVirtuals = (schema) => {
  // Use calculatedSpentBudget for runtime consistency
  schema.virtual('calculatedSpentBudget').get(function() {
    return this.spentBudget || 0;
  });

  // Virtual for remaining budget
  schema.virtual('remainingBudget').get(function() {
    return this.budget - (this.spentBudget + (this.reservedBudget || 0));
  });

  // Virtual for budget utilization percentage
  schema.virtual('budgetUtilization').get(function() {
    if (this.budget === 0) return 0;
    return (this.spentBudget / this.budget) * 100;
  });

  // Virtual for progress percentage
  schema.virtual('progress').get(function() {
    if (this.maxPromoters === 0) return 0;
    return (this.currentPromoters / this.maxPromoters) * 100;
  });

  // Virtual for remaining days
  schema.virtual('remainingDays').get(function() {
    return calculateRemainingDays(this.endDate, this.status);
  });

  // Virtual for promotions population
  schema.virtual('promotions', {
    ref: 'Promotion',
    localField: '_id',
    foreignField: 'campaign'
  });

  // Virtual for campaign age in days
  schema.virtual('ageInDays').get(function() {
    return calculateDaysBetween(this.createdAt, new Date());
  });

  // Virtual for average payout per promotion
  schema.virtual('averagePayoutPerPromotion').get(function() {
    if (this.totalPromotions === 0) return 0;
    return this.totalPayouts / this.totalPromotions;
  });

  // Virtual for conversion rate (validated/paid ratio)
  schema.virtual('conversionRate').get(function() {
    if (this.totalPromotions === 0) return 0;
    return (this.validatedPromotions / this.totalPromotions) * 100;
  });

  // Virtual for budget efficiency
  schema.virtual('budgetEfficiency').get(function() {
    if (this.spentBudget === 0) return 0;
    return this.validatedPromotions / (this.spentBudget / 1000); // Per 1000 NGN
  });

  // Virtual for isActive (convenience)
  schema.virtual('isActive').get(function() {
    return this.status === 'active' && !this.isDeleted;
  });

  // Virtual for canAcceptPromoters
  schema.virtual('canAcceptPromoters').get(function() {
    const unitCost = Number(this.costPerClick ?? this.payoutPerPromotion ?? 0);
    const hasPromoterSlot = !this.maxPromoters || this.currentPromoters < this.maxPromoters;

    return this.status === 'active' && 
           hasPromoterSlot &&
           this.remainingBudget >= unitCost;
  });
};
