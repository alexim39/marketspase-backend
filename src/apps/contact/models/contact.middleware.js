import { CONTACT_STATUS } from "./contact.constants.js";

export const setupContactMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Set resolvedAt if status is resolved or closed
    if (this.isModified('status') && 
        (this.status === CONTACT_STATUS.RESOLVED || this.status === CONTACT_STATUS.CLOSED)) {
      this.resolvedAt = new Date();
    }
    
    // Clear resolvedAt if status changes from resolved/closed to something else
    if (this.isModified('status') && 
        this.status !== CONTACT_STATUS.RESOLVED && 
        this.status !== CONTACT_STATUS.CLOSED) {
      this.resolvedAt = null;
    }
    
    // Ensure requestID is set
    if (this.isNew && !this.requestID) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9).toUpperCase();
      this.requestID = `CT-${timestamp}-${random}`;
    }
    
    // Trim strings
    if (this.subject) this.subject = this.subject.trim();
    if (this.message) this.message = this.message.trim();
    if (this.userEmail) this.userEmail = this.userEmail.toLowerCase().trim();
    
    // Set metadata if not provided
    if (this.isNew && !this.metadata) {
      this.metadata = {};
    }
    
    next();
  });
  
  // Pre-update middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    
    // Update updatedAt
    if (update) {
      update.updatedAt = new Date();
      
      // Handle resolvedAt for status changes
      if (update.status) {
        if (update.status === CONTACT_STATUS.RESOLVED || update.status === CONTACT_STATUS.CLOSED) {
          update.resolvedAt = new Date();
        } else {
          update.resolvedAt = null;
        }
      }
    }
    
    next();
  });
  
  // Post-save middleware
  schema.post('save', function(doc) {
    // You could emit events here for real-time updates
    // For example: emit('contact.created', doc);
  });
  
  // Post-find middleware to populate common fields - FIXED VERSION
  schema.post('find', async function(docs) {
    if (!docs) return;
    
    const populateFields = async (doc) => {
      if (doc && typeof doc.populate === 'function') {
        // Use await with populate instead of chaining
        await doc.populate('user', 'username displayName email avatar');
        await doc.populate('assignedTo', 'username displayName');
        await doc.populate('adminNotes.admin', 'username displayName');
      }
    };
    
    if (Array.isArray(docs)) {
      await Promise.all(docs.map(populateFields));
    } else {
      await populateFields(docs);
    }
  });
  
  // Also add post-findOne middleware
  schema.post('findOne', async function(doc) {
    if (!doc) return;
    
    if (doc && typeof doc.populate === 'function') {
      await doc.populate('user', 'username displayName email avatar');
      await doc.populate('assignedTo', 'username displayName');
      await doc.populate('adminNotes.admin', 'username displayName');
    }
  });
};