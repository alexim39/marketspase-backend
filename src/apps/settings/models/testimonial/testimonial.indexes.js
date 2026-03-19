export const setupTestimonialIndexes = (schema) => {
  // Basic indexes
  schema.index({ user: 1 });
  schema.index({ status: 1 });
  schema.index({ isFeatured: 1 });
  schema.index({ rating: -1 });
  
  // Reactions indexes
  schema.index({ 'reactions.userId': 1 });
  schema.index({ 'reactions.createdAt': 1 });
  
  // Compound indexes for common queries
  schema.index({ status: 1, isFeatured: 1, createdAt: -1 });
  schema.index({ status: 1, rating: -1, createdAt: -1 });
  schema.index({ user: 1, status: 1, createdAt: -1 });
  
  // Index for moderation queue
  schema.index({ 
    status: 1, 
    createdAt: 1,
    reviewedAt: 1 
  });
  
  // Index for soft delete
  schema.index({ isDeleted: 1, deletedAt: 1 });
  
  // Index for featured testimonials
  schema.index({ 
    isFeatured: 1, 
    status: 1, 
    rating: -1 
  });
  
  // Text index for search
  schema.index({ message: 'text' });
  
  // Index for statistics
  schema.index({ 
    status: 1, 
    rating: 1, 
    likes: -1 
  });
};