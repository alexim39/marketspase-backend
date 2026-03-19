import { calculatePerformanceScore, isEligibleForPremiumVerification } from './store.utils.js';

export const setupStoreVirtuals = (schema) => {
  // Virtual for product count
  schema.virtual('productCount').get(function() {
    return this.storeProducts?.length || 0;
  });

  // Virtual for campaign count
  schema.virtual('campaignCount').get(function() {
    return this.activeCampaigns?.length || 0;
  });

  // Virtual for store URL
  schema.virtual('storeUrl').get(function() {
    return `/store/${this.storeLink}`;
  });

  // Virtual for full address
  schema.virtual('fullAddress').get(function() {
    if (!this.address) return null;
    
    const parts = [];
    if (this.address.street) parts.push(this.address.street);
    if (this.address.city) parts.push(this.address.city);
    if (this.address.state) parts.push(this.address.state);
    if (this.address.country) parts.push(this.address.country);
    
    return parts.length > 0 ? parts.join(', ') : null;
  });

  // Virtual for performance score
  schema.virtual('performanceScore').get(function() {
    return calculatePerformanceScore(this.analytics);
  });

  // Virtual for is premium eligible
  schema.virtual('isPremiumEligible').get(function() {
    return isEligibleForPremiumVerification(this);
  });

  // Virtual for average daily views (last 30 days)
  schema.virtual('averageDailyViews').get(function() {
    // This would need to be calculated from analytics data
    // For now, return a placeholder or 0
    return this.analytics?.totalViews ? Math.round(this.analytics.totalViews / 30) : 0;
  });

  // Virtual for conversion rate display
  schema.virtual('conversionRateDisplay').get(function() {
    return `${this.analytics?.conversionRate?.toFixed(1) || 0}%`;
  });

  // Virtual for store age in days
  schema.virtual('storeAgeDays').get(function() {
    const diffMs = Date.now() - this.createdAt;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  });

  // Virtual for has WhatsApp
  schema.virtual('hasWhatsApp').get(function() {
    return !!this.whatsappNumber;
  });

  // Virtual for is recently active (updated in last 7 days)
  schema.virtual('isRecentlyActive').get(function() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return this.updatedAt > sevenDaysAgo;
  });
};