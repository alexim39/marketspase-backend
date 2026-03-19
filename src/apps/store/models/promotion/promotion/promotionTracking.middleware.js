export const setupPromotionMiddleware = (schema) => {
  schema.pre('save', function(next) {
    // Generate unique code if not provided
    if (!this.uniqueCode) {
      const random = Math.random().toString(36).substring(2, 10).toUpperCase();
      this.uniqueCode = `PROMO-${random}`;
    }
    
    // Generate unique ID if not provided
    if (!this.uniqueId) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      this.uniqueId = `${this.promoter.toString().substring(0, 4)}-${this.product.toString().substring(0, 4)}-${timestamp}-${random}`;
    }
    
    // Calculate rates
    if (this.viewCount > 0) {
      this.clickThroughRate = (this.clickCount / this.viewCount) * 100;
    }
    if (this.clickCount > 0) {
      this.conversionRate = (this.conversionCount / this.clickCount) * 100;
    }
    
    this.lastActivityAt = new Date();
    
    next();
  });
};