export const setupCommentIndexes = (schema) => {
  // Basic indexes
  schema.index({ thread: 1, createdAt: -1 });
  schema.index({ author: 1, createdAt: -1 });
  schema.index({ parentComment: 1, createdAt: -1 });
  
  // Compound indexes for common queries
  schema.index({ 
    thread: 1, 
    parentComment: 1, 
    createdAt: -1 
  });
  
  schema.index({ 
    thread: 1, 
    isDeleted: 1, 
    createdAt: -1 
  });
  
  // Index for like queries
  schema.index({ likeCount: -1, createdAt: -1 });
  
  // Index for user's comments
  schema.index({ author: 1, isDeleted: 1, createdAt: -1 });
  
  // Index for moderation
  schema.index({ status: 1, flaggedBy: 1 });
  
  // Index for mentions
  schema.index({ 'mentions.user': 1 });
  
  // Index for hashtags
  schema.index({ 'hashtags.tag': 1 });
  
  // Text index for search
  schema.index({ 
    content: 'text' 
  });
  
  // Index for deleted comments cleanup
  schema.index({ isDeleted: 1, deletedAt: 1 });
  
  // Compound index for pagination
  schema.index({ 
    thread: 1, 
    isDeleted: 1, 
    parentComment: 1, 
    createdAt: -1 
  });
  
  // Index for edit history
  schema.index({ 'editHistory.editedAt': -1 });
};