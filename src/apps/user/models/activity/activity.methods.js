export const setupActivityMethods = (schema) => {
  // Add metadata to activity
  schema.methods.addMetadata = function(key, value) {
    this.metadata = {
      ...this.metadata,
      [key]: value
    };
    return this;
  };

  // Set severity level
  schema.methods.setSeverity = function(severity) {
    const validSeverities = ['info', 'warning', 'critical'];
    if (validSeverities.includes(severity)) {
      this.severity = severity;
    }
    return this;
  };

  // Check if activity is of a certain type
  schema.methods.isAction = function(action) {
    return this.action === action;
  };

  // Check if activity involves a specific resource
  schema.methods.involvesResource = function(resourceType, resourceId) {
    return this.resourceType === resourceType && 
           (!resourceId || this.resourceId?.equals(resourceId));
  };

  // Get formatted activity summary
  schema.methods.getSummary = function() {
    return {
      id: this._id,
      action: this.action,
      description: this.description,
      timestamp: this.timestamp,
      severity: this.severity,
      resource: this.resourceType ? {
        type: this.resourceType,
        id: this.resourceId
      } : null
    };
  };

  // Anonymize IP for privacy (useful for GDPR compliance)
  schema.methods.anonymizeIp = function() {
    if (this.ipAddress) {
      // Simple anonymization - remove last octet for IPv4
      const parts = this.ipAddress.split('.');
      if (parts.length === 4) {
        parts[3] = '0';
        this.ipAddress = parts.join('.');
      }
    }
    return this;
  };
};