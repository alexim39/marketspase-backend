// promotionTracking.middleware.js
export const setupPromotionMiddleware = (schema) => {
  //console.log('Setting up promotion middleware...');
  
  // schema.pre('save', function(next) {
  //   console.log('Save middleware executing...');
    
  //   // Generate unique code if not provided
  //   if (!this.uniqueCode) {
  //     const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  //     this.uniqueCode = `promo-${random}`;
  //     console.log('Generated uniqueCode:', this.uniqueCode);
  //   }
    
  //   // Generate unique ID if not provided
  //   if (!this.uniqueId) {
  //     const timestamp = Date.now().toString(36);
  //     const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  //     const promoterId = this.promoter ? this.promoter.toString().substring(0, 4) : 'NONE';
  //     const productId = this.product ? this.product.toString().substring(0, 4) : 'NONE';
  //     this.uniqueId = `${promoterId}-${productId}-${timestamp}-${random}`;
  //     console.log('Generated uniqueId:', this.uniqueId);
  //   }
    
  //   // Calculate rates
  //   if (this.viewCount > 0) {
  //     this.clickThroughRate = (this.clickCount / this.viewCount) * 100;
  //   }
  //   if (this.clickCount > 0) {
  //     this.conversionRate = (this.conversionCount / this.clickCount) * 100;
  //   }
    
  //   this.lastActivityAt = new Date();
    
  //   next();
  // });
};

// Also add a default export as fallback
export default setupPromotionMiddleware;