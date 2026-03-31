export const setupWhatsAppIntegrationVirtuals = (schema) => {
  // Virtual for active templates count
  schema.virtual('activeTemplatesCount').get(function() {
    return this.templates?.filter(t => t.isActive).length || 0;
  });

  // Virtual for active auto responses count
  schema.virtual('activeAutoResponsesCount').get(function() {
    return this.autoResponses?.filter(a => a.isActive).length || 0;
  });

  // Virtual for quick replies count
  schema.virtual('quickRepliesCount').get(function() {
    return this.quickReplies?.length || 0;
  });

  // Virtual for has webhook
  schema.virtual('hasWebhook').get(function() {
    return !!(this.webhook?.url && this.webhook?.isActive);
  });

  // Virtual for has business profile
  schema.virtual('hasBusinessProfile').get(function() {
    return !!(this.businessProfile?.businessName || this.businessProfile?.supportPhone);
  });

  // Virtual for template categories
  schema.virtual('templateCategories').get(function() {
    if (!this.templates || this.templates.length === 0) return {};
    
    const categories = {};
    this.templates.forEach(template => {
      const category = template.category || 'uncategorized';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return categories;
  });

  // Virtual for most used templates
  schema.virtual('mostUsedTemplates').get(function() {
    // This would need to be tracked separately
    return [];
  });

  // Virtual for integration completeness score
  schema.virtual('completenessScore').get(function() {
    let score = 0;
    let total = 5;

    if (this.templates && this.templates.length > 0) score += 1;
    if (this.quickReplies && this.quickReplies.length > 0) score += 1;
    if (this.autoResponses && this.autoResponses.length > 0) score += 1;
    if (this.businessProfile?.businessName) score += 1;
    if (this.webhook?.isActive) score += 1;

    return (score / total) * 100;
  });

  // Virtual for is configured
  schema.virtual('isConfigured').get(function() {
    return this.templates && this.templates.length > 0;
  });

  // Virtual for greeting templates
  schema.virtual('greetingTemplates').get(function() {
    return this.templates?.filter(t => t.category === 'greeting') || [];
  });

  // Virtual for support templates
  schema.virtual('supportTemplates').get(function() {
    return this.templates?.filter(t => t.category === 'support') || [];
  });

  // Virtual for marketing templates
  schema.virtual('marketingTemplates').get(function() {
    return this.templates?.filter(t => t.category === 'marketing') || [];
  });
};