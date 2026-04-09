// promotionTracking.middleware.js
export const setupPromotionMiddleware = (schema) => {
  //console.log('Setting up promotion middleware...');

  // ✅ Generate required fields BEFORE validation runs
  schema.pre('validate', function(next) {
    // Generate unique code if not provided
    if (!this.uniqueCode) {
      const random = Math.random().toString(36).substring(2, 10).toLowerCase();
      this.uniqueCode = `${random}`;
      // this.uniqueCode = `promo-${random}`;
      //console.log('Generated uniqueCode:', this.uniqueCode);
    }

    // Generate unique ID if not provided
    if (!this.uniqueId) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 6).toLowerCase();
      const promoterId = this.promoter ? this.promoter.toString().substring(0, 4) : 'NONE';
      const productId = this.product ? this.product.toString().substring(0, 4) : 'NONE';
      this.uniqueId = `${promoterId}-${productId}-${timestamp}-${random}`;
      //console.log('Generated uniqueId:', this.uniqueId);
    }

    next();
  });

  // Optional: keep save hook for recalculations/timestamps only
  schema.pre('save', function(next) {
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

// Also add a default export as fallback
export default setupPromotionMiddleware;