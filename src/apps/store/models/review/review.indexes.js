export const setupReviewIndexes = (schema) => {
  // Basic indexes
  schema.index({ productId: 1, status: 1, createdAt: -1 });
  schema.index({ userId: 1, productId: 1 }, { unique: true });
  schema.index({ rating: 1, helpfulCount: -1 });
  schema.index({ verifiedPurchase: 1, createdAt: -1 });
  
  // Compound indexes for common queries
  schema.index({ storeId: 1, status: 1, createdAt: -1 });
  schema.index({ status: 1, createdAt: 1 }); // For moderation queue
  schema.index({ isFeatured: 1, createdAt: -1 });
  
  // Engagement indexes
  schema.index({ helpfulCount: -1, createdAt: -1 });
  schema.index({ reportCount: -1, status: 1 });
  
  // User interaction indexes
  schema.index({ 'helpfulBy': 1 });
  schema.index({ 'reportedBy.user': 1 });
  
  // Date range indexes
  schema.index({ createdAt: -1, updatedAt: -1 });
  
  // Text index for search
  schema.index({ 
    title: 'text', 
    comment: 'text',
    'response.content': 'text' 
  });
  
  // Compound index for product filtering
  schema.index({ 
    productId: 1, 
    status: 1, 
    rating: 1, 
    verifiedPurchase: 1,
    createdAt: -1 
  });
  
  // Index for flagged reviews
  schema.index({ 
    status: 1, 
    reportCount: -1, 
    createdAt: 1 
  });
};