export const setupPromotionIndexes = (schema) => {
  schema.index({ product: 1, promoter: 1 }, { unique: true, sparse: true, partialFilterExpression: { product: { $exists: true } } });
  schema.index({ service: 1, promoter: 1 }, { unique: true, sparse: true, partialFilterExpression: { service: { $exists: true } } });
  schema.index({ promoter: 1, isActive: 1, isApproved: 1 });
  schema.index({ store: 1, product: 1, isActive: 1 });
  schema.index({ uniqueCode: 1 }, { unique: true });
  schema.index({ uniqueId: 1 }, { unique: true });
  schema.index({ createdAt: -1 });
  schema.index({ earnings: -1 });
  schema.index({ store: 1, product: 1, isActive: 1, isApproved: 1 });
  schema.index({ promoter: 1, createdAt: -1, earnings: -1 });
  schema.index({ product: 1, conversionCount: -1 });
};