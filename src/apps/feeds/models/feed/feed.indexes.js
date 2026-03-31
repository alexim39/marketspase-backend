export const setupFeedIndexes = (schema) => {
  // Basic indexes
  schema.index({ author: 1, createdAt: -1 });
  schema.index({ type: 1, createdAt: -1 });
  schema.index({ status: 1, createdAt: -1 });
  
  // Engagement indexes
  schema.index({ 'likes.user': 1 });
  schema.index({ 'comments.user': 1 });
  schema.index({ 'savedBy.user': 1 });
  schema.index({ 'shares.user': 1 });
  
  // Hashtag and mention indexes
  schema.index({ hashtags: 1 });
  schema.index({ 'mentions.user': 1 });
  
  // Trending and featured indexes
  schema.index({ createdAt: -1, trendingScore: -1 });
  schema.index({ isFeatured: 1, featuredUntil: 1 });
  
  // Reach indexes
  schema.index({ 'reach.uniqueViews': 1 });
  schema.index({ 'reach.lastImpressionAt': -1 });
  
  // Moderation indexes
  schema.index({ 'moderation.isFlagged': 1, status: 1 });
  
  // Compound indexes for common queries
  schema.index({ 
    status: 1, 
    type: 1, 
    createdAt: -1 
  });
  
  schema.index({ 
    author: 1, 
    status: 1, 
    createdAt: -1 
  });
  
  schema.index({ 
    'hashtags.tag': 1, 
    status: 1, 
    createdAt: -1 
  });
  
  // Text index for search
  schema.index({ 
    content: 'text', 
    'hashtags.tag': 'text' 
  });
  
  // Geospatial index
  schema.index({ location: '2dsphere' });
};