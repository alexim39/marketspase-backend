export const setupStoreAnalyticsIndexes = (schema) => {
  // Unique index on store
  schema.index({ store: 1 }, { unique: true });
  
  // Index for date-based queries
  schema.index({ 'dailyViews.date': 1 });
  
  // Compound index for store + date queries
  schema.index({ store: 1, 'dailyViews.date': -1 });
  
  // Index for promoter performance queries
  schema.index({ 'promoterPerformance.promoter': 1 });
  schema.index({ 'promoterPerformance.commissionEarned': -1 });
  
  // Index for top products queries
  schema.index({ 'salesData.topProducts.product': 1 });
  schema.index({ 'salesData.topProducts.sales': -1 });
  
  // Index for last calculated field
  schema.index({ lastCalculated: -1 });
  
  // Index for metadata fields
  schema.index({ 'metadata.totalRevenue': -1 });
  schema.index({ 'metadata.activePromoters': -1 });
  
  // Compound index for platform-wide analytics
  schema.index({ 
    'salesData.totalRevenue': -1,
    'salesData.conversionRate': -1 
  });
};