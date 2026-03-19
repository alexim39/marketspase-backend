export const setupContactIndexes = (schema) => {
  // Basic indexes
  schema.index({ status: 1, createdAt: -1 });
  schema.index({ priority: 1, createdAt: -1 });
  schema.index({ user: 1, createdAt: -1 });
  schema.index({ category: 1, createdAt: -1 });
  schema.index({ assignedTo: 1, status: 1 });
  
  // Compound indexes for common queries
  schema.index({ status: 1, priority: 1, createdAt: -1 });
  schema.index({ assignedTo: 1, status: 1, priority: -1 });
  schema.index({ user: 1, status: 1, createdAt: -1 });
  
  // Index for unread queries
  schema.index({ isRead: 1, isArchived: 1, createdAt: -1 });
  
  // Index for archived queries
  schema.index({ isArchived: 1, updatedAt: -1 });
  
  // Index for follow-up queries
  schema.index({ followUpDate: 1, status: 1 });
  
  // Unique index on requestID
  schema.index({ requestID: 1 }, { unique: true });
  
  // Index for search
  schema.index({ subject: 'text', message: 'text', tags: 'text' });
  
  // Index for user email
  schema.index({ userEmail: 1 });
  
  // Index for date range queries
  schema.index({ createdAt: 1, updatedAt: 1 });
  
  // Index for admin notes
  schema.index({ 'adminNotes.admin': 1, 'adminNotes.createdAt': -1 });
  
  // Index for attachments
  schema.index({ 'attachments.uploadedAt': -1 });
  
  // Compound index for dashboard queries
  schema.index({ 
    status: 1, 
    priority: 1, 
    assignedTo: 1, 
    isArchived: 1, 
    createdAt: -1 
  });
};