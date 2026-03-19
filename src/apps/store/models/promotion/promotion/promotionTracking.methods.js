export const setupPromotionMethods = (schema) => {
  schema.methods.incrementClicks = async function() {
    this.clickCount += 1;
    this.lastActivityAt = new Date();
    return this.save();
  };

  schema.methods.getStats = function() {
    return {
      views: this.viewCount,
      clicks: this.clickCount,
      conversions: this.conversionCount,
      earnings: this.earnings,
      clickThroughRate: this.clickThroughRate,
      conversionRate: this.conversionRate,
      averageOrderValue: this.averageOrderValue
    };
  };
};