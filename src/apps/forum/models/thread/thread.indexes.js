export const setupThreadIndexes = (schema) => {
  // Text index for search
  schema.index({ title: 'text', content: 'text', tags: 'text' });
  
  // Basic indexes
  schema.index({ author: 1, createdAt: -1 });
  schema.index({ category: 1, createdAt: -1 });
  schema.index({ tags: 1, createdAt: -1 });
  schema.index({ status: 1, createdAt: -1 });
  
  // Compound indexes for common queries
  schema.index({ isPinned: -1, pinnedAt: -1 });
  schema.index({ isLocked: 1, createdAt: -1 });
  schema.index({ isDeleted: 1, deletedAt: -1 });
  
  // Engagement indexes
  schema.index({ likeCount: -1, createdAt: -1 });
  schema.index({ commentCount: -1, createdAt: -1 });
  schema.index({ viewCount: -1, createdAt: -1 });
  
  // Trending score index
  schema.index({ trendingScore: -1, createdAt: -1 });
  
  // Last activity index
  schema.index({ lastActivityAt: -1 });
  
  // Category + status compound index
  schema.index({ category: 1, status: 1, createdAt: -1 });
  
  // Author + status compound index
  schema.index({ author: 1, status: 1, createdAt: -1 });
  
  // Tags + status compound index
  schema.index({ tags: 1, status: 1, createdAt: -1 });
  
  // Hashtags index
  schema.index({ 'hashtags.tag': 1 });
  
  // Mentions index
  schema.index({ 'mentions.user': 1 });
  
  // Index for date range queries
  schema.index({ createdAt: 1, updatedAt: 1 });
  
  // Unique index on slug
  schema.index({ slug: 1 }, { unique: true, sparse: true });
  
  // Compound index for pinned threads in categories
  schema.index({ category: 1, isPinned: -1, pinnedAt: -1 });
};