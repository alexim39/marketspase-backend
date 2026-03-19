import { generateHtmlContent, generatePlainTextContent } from "./newsletter.utils.js";

export const setupNewsletterMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Auto-generate HTML and plain text content if not provided
    if (this.isModified('content') && this.content) {
      if (!this.htmlContent) {
        this.htmlContent = generateHtmlContent(this.content);
      }
      
      if (!this.plainTextContent) {
        this.plainTextContent = generatePlainTextContent(this.content);
      }
    }
    
    // Set estimated recipients based on recipient type
    if (this.isModified('recipientType') || this.isModified('externalEmails')) {
      if (this.recipientType === 'external') {
        this.estimatedRecipients = this.externalEmails ? this.externalEmails.length : 0;
      }
    }
    
    // Update timestamps for status changes
    if (this.isModified('status')) {
      if (this.status === 'sent' && !this.sentDate) {
        this.sentDate = new Date();
      }
      
      if (this.status === 'scheduled' && this.sendOption === 'schedule' && !this.scheduledDate) {
        // If status is scheduled but no scheduled date, set to now + 1 hour as default
        this.scheduledDate = new Date(Date.now() + 60 * 60 * 1000);
      }
    }

    // Ensure rates are within valid range
    if (this.isModified('openRate')) {
      this.openRate = Math.min(100, Math.max(0, this.openRate));
    }
    
    if (this.isModified('clickRate')) {
      this.clickRate = Math.min(100, Math.max(0, this.clickRate));
    }

    // Add initial version if new and no versions exist
    if (this.isNew && (!this.contentVersions || this.contentVersions.length === 0)) {
      this.contentVersions = [{
        version: 1,
        subject: this.subject,
        previewText: this.previewText,
        content: this.content,
        htmlContent: this.htmlContent,
        plainTextContent: this.plainTextContent,
        createdAt: new Date(),
        createdBy: this.createdBy
      }];
    }

    next();
  });

  // Pre-update middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();

    // Auto-generate HTML and plain text content if content is updated
    if (update.content) {
      if (!update.htmlContent) {
        update.htmlContent = generateHtmlContent(update.content);
      }
      if (!update.plainTextContent) {
        update.plainTextContent = generatePlainTextContent(update.content);
      }
    }

    // Update estimated recipients if recipient type or external emails change
    if (update.recipientType === 'external' && update.externalEmails) {
      update.estimatedRecipients = update.externalEmails.length;
    }

    next();
  });

  // Post-save middleware
  schema.post('save', function(doc) {
    // Could emit events for real-time updates
    // emit('newsletter.saved', doc);
  });

  // Pre-delete middleware
  schema.pre('deleteOne', { document: true }, async function(next) {
    // Could add cleanup logic here
    next();
  });
};