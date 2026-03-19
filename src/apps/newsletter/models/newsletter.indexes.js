export const setupNewsletterIndexes = (schema) => {
  // Basic indexes
  schema.index({ status: 1, scheduledDate: 1 });
  schema.index({ createdBy: 1, createdAt: -1 });
  schema.index({ recipientType: 1 });
  schema.index({ scheduledDate: 1 });
  schema.index({ campaignId: 1 });
  schema.index({ tags: 1 });
  schema.index({ isDeleted: 1 });
  
  // Compound indexes for common queries
  schema.index({ createdAt: -1, status: 1 });
  schema.index({ scheduledDate: 1, status: 1 });
  
  // Engagement indexes
  schema.index({ 'engagement.email': 1 });
  schema.index({ 'engagement.openedAt': -1 });
  schema.index({ 'engagement.clickedAt': -1 });
  
  // Delivery status indexes
  schema.index({ 'deliveryStatus.email': 1 });
  schema.index({ 'deliveryStatus.status': 1 });
  
  // Performance metrics indexes
  schema.index({ openRate: -1, clickRate: -1 });
  schema.index({ sentDate: -1 });
  
  // Index for scheduled jobs
  schema.index({ 
    status: 1, 
    scheduledDate: 1, 
    isDeleted: 1 
  });
  
  // Index for cleanup jobs
  schema.index({ 
    isDeleted: 1, 
    deletedAt: 1 
  });
  
  // Text index for search
  schema.index({ 
    title: 'text', 
    subject: 'text', 
    content: 'text',
    previewText: 'text',
    tags: 'text'
  });
  
  // Index for A/B testing queries
  schema.index({ 'abTest.parentNewsletter': 1 });
  schema.index({ 'abTest.isVariation': 1 });
};