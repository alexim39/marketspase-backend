export const setupActivityMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Sanitize metadata if needed
    if (this.metadata && typeof this.metadata === 'object') {
      // Remove sensitive information if any
      const sensitiveFields = ['password', 'token', 'secret'];
      sensitiveFields.forEach(field => {
        if (this.metadata[field]) {
          delete this.metadata[field];
        }
      });
    }
    
    // Truncate userAgent if too long
    if (this.userAgent && this.userAgent.length > 500) {
      this.userAgent = this.userAgent.substring(0, 500);
    }
    
    // Ensure description is not too long
    if (this.description && this.description.length > 1000) {
      this.description = this.description.substring(0, 1000);
    }
    
    next();
  });

  // Post-save middleware for critical activities
  schema.post('save', function(doc) {
    if (doc.severity === 'critical') {
      // You could emit an event, send notification, etc.
      // For example: eventEmitter.emit('critical-activity', doc);
      console.log(`Critical activity logged: ${doc.action} - ${doc.description}`);
    }
  });
};