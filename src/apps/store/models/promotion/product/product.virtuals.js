export const setupProductVirtuals = (schema) => {
  schema.virtual('isInStock').get(function() {
    if (!this.manageStock) return true;
    return this.quantity > 0;
  });

  schema.virtual('isLowStock').get(function() {
    if (!this.manageStock) return false;
    return this.quantity > 0 && this.quantity <= this.lowStockAlert;
  });

  schema.virtual('isOutOfStock').get(function() {
    if (!this.manageStock) return false;
    return this.quantity === 0;
  });

  schema.virtual('discountPercentage').get(function() {
    if (!this.originalPrice || this.originalPrice <= this.price) return 0;
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  });

  schema.virtual('mainImage').get(function() {
    const mainImg = this.images?.find(img => img.isMain);
    return mainImg ? mainImg.url : (this.images?.[0]?.url || null);
  });
};