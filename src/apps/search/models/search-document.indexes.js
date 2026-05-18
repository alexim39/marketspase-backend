export const setupSearchDocumentIndexes = (schema) => {
  schema.index({ entityType: 1, entityId: 1 }, { unique: true });
  schema.index({ entityType: 1, ownerId: 1, isDeleted: 1, updatedAt: -1 });
  schema.index({ entityType: 1, relatedOwnerId: 1, isDeleted: 1, updatedAt: -1 });
  schema.index({ entityType: 1, isActive: 1, isDeleted: 1, status: 1, updatedAt: -1 });
  schema.index({ searchPrefixes: 1, entityType: 1, isDeleted: 1 });
  schema.index({ searchTerms: 1, entityType: 1, isDeleted: 1 });
  schema.index({ userType: 1, entityType: 1, isDeleted: 1 });
  schema.index({ 'region.country': 1, 'region.state': 1, 'region.city': 1, entityType: 1 });
  schema.index({
    title: 'text',
    subtitle: 'text',
    description: 'text',
    keywords: 'text',
  }, {
    weights: {
      title: 10,
      subtitle: 6,
      description: 2,
      keywords: 7,
    },
    name: 'global_search_text_idx',
  });
};
