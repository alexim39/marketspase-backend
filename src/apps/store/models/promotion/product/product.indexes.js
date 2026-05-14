export const setupProductIndexes = (schema) => {
  schema.index({ store: 1, isActive: 1, isDeleted: 1 });
  schema.index({ category: 1, isActive: 1, isDeleted: 1 });
  schema.index({ tags: 1, isActive: 1 });
  schema.index({ price: 1, isActive: 1 });
  schema.index({ isFeatured: 1, isActive: 1, createdAt: -1 });
  schema.index({ "seo.slug": 1 }, { unique: true, sparse: true });
  schema.index({ sku: 1 }, { unique: true, sparse: true });
  schema.index({ "variants.sku": 1 }, { sparse: true });
  schema.index({ name: "text", description: "text", tags: "text" });
  schema.index({ store: 1, isPublished: 1, isActive: 1 });
  schema.index({ store: 1, category: 1, price: 1, isActive: 1 });
  schema.index({ store: 1, isFeatured: 1, createdAt: -1 });
  schema.index({ store: 1, tags: 1, isActive: 1 });
  schema.index({ "affiliate.enabled": 1, "affiliate.commissionRate": -1 });
};
