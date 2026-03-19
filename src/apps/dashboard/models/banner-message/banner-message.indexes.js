export const setupBannerMessageIndexes = (schema) => {
  // Compound index for active banner queries
  schema.index({ 
    isActive: 1, 
    startDate: 1, 
    endDate: 1,
    targetAudience: 1 
  });
  
  // Index for priority-based queries
  schema.index({ priority: -1, createdAt: -1 });
  
  // Index for type-based queries
  schema.index({ type: 1, isActive: 1 });
  
  // Index for date range queries
  schema.index({ startDate: 1, endDate: 1 });
  
  // Index for creator queries
  schema.index({ createdBy: 1, createdAt: -1 });
  
  // Index for soft delete queries
  schema.index({ isDeleted: 1, deletedAt: -1 });
  
  // Index for statistics aggregation
  schema.index({ viewCount: -1, dismissCount: -1, clickCount: -1 });
  
  // Compound index for scheduled banners
  schema.index({ 
    isActive: 1, 
    startDate: 1, 
    priority: -1 
  });
  
  // Index for text search
  schema.index({ 
    title: 'text', 
    message: 'text' 
  });
  
  // Index for specific user groups
  schema.index({ 
    targetAudience: 1, 
    specificUserGroups: 1 
  });
};