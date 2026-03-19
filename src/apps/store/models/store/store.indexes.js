export const setupStoreIndexes = (schema) => {
  // Unique index on owner + isDefaultStore
  schema.index(
    { owner: 1, isDefaultStore: 1 }, 
    { 
      unique: true, 
      partialFilterExpression: { isDefaultStore: true } 
    }
  );
  
  // Unique index on storeLink
  schema.index({ storeLink: 1 }, { unique: true });
  
  // Indexes for common queries
  schema.index({ owner: 1, isDeleted: 1 });
  schema.index({ isVerified: 1, verificationTier: 1 });
  schema.index({ category: 1, isActive: 1 });
  schema.index({ isActive: 1, isDeleted: 1 });
  
  // Analytics indexes
  schema.index({ 'analytics.totalSales': -1 });
  schema.index({ 'analytics.totalViews': -1 });
  schema.index({ 'analytics.conversionRate': -1 });
  
  // Index for search
  schema.index({ 
    name: 'text', 
    description: 'text', 
    storeLink: 'text' 
  });
  
  // Index for address queries
  schema.index({ 'address.country': 1, 'address.state': 1, 'address.city': 1 });
  
  // Index for soft delete cleanup
  schema.index({ isDeleted: 1, deletedAt: 1 });
  
  // Index for WhatsApp integration
  schema.index({ whatsappNumber: 1 }, { sparse: true });
  
  // Compound index for store listing
  schema.index({ 
    isVerified: -1, 
    'analytics.totalSales': -1, 
    createdAt: -1 
  });
};