export const setupCampaignIndexes = (schema) => {
  // Basic indexes
  schema.index({ category: 1, status: 1 });
  schema.index({ startDate: 1, endDate: 1 });
  schema.index({ status: 1, priority: -1 });
  schema.index({ 'notificationLog.sentAt': 1 });
  schema.index({ spentBudget: 1, budget: 1 });
  
  // Targeting indexes
  schema.index({ ageTarget: 1, status: 1 });
  schema.index({ category: 1, ageTarget: 1, status: 1 });
  schema.index({ priority: -1, createdAt: -1 });
  
  // New recommended indexes
  schema.index({ enableTarget: 1, status: 1 });
  schema.index({ minRating: 1, status: 1 });
  schema.index({ 'targetLocations.name': 1, status: 1 });
  schema.index({ isDeleted: 1, status: 1 });
  schema.index({ category: 1, enableTarget: 1, status: 1 });
  
  // Owner indexes
  schema.index({ owner: 1, status: 1, createdAt: -1 });
  schema.index({ owner: 1, isDeleted: 1 });
  
  // Budget and promotion indexes
  schema.index({ budget: 1, spentBudget: 1, reservedBudget: 1 });
  schema.index({ payoutPerPromotion: 1, minViewsPerPromotion: 1 });
  
  // Date range indexes
  schema.index({ startDate: -1, endDate: -1 });
  schema.index({ createdAt: -1, updatedAt: -1 });
  
  // Compound indexes for common queries
  schema.index({ 
    status: 1, 
    enableTarget: 1, 
    minRating: 1, 
    currentPromoters: 1, 
    maxPromoters: 1 
  });
  
  // Text index for searching
  schema.index({ 
    title: 'text', 
    caption: 'text', 
    category: 'text', 
    tags: 'text' 
  });
};