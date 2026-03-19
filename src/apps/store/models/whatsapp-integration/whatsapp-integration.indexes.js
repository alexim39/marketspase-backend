export const setupWhatsAppIntegrationIndexes = (schema) => {
  // Unique index on store
  schema.index({ store: 1 }, { unique: true });
  
  // Index for template searches
  schema.index({ 'templates.name': 1 });
  schema.index({ 'templates.category': 1 });
  schema.index({ 'templates.isActive': 1 });
  
  // Index for auto response triggers
  schema.index({ 'autoResponses.trigger': 1 });
  schema.index({ 'autoResponses.isActive': 1 });
  
  // Index for webhook queries
  schema.index({ 'webhook.isActive': 1 });
  
  // Index for statistics
  schema.index({ 'stats.messagesSent': -1 });
  
  // Compound index for template lookups
  schema.index({ 
    store: 1, 
    'templates.name': 1, 
    'templates.isActive': 1 
  });
  
  // Index for soft delete
  schema.index({ isDeleted: 1, deletedAt: 1 });
  
  // Index for business profile searches
  schema.index({ 'businessProfile.businessName': 'text' });
  
  // Index for template text search
  schema.index({ 
    'templates.name': 'text', 
    'templates.message': 'text' 
  });
};