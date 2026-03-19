import { CONTACT_STATUS, ACTIVITY_ACTIONS } from "./contact.constants.js";

export const setupContactMethods = (schema) => {
  // Add admin note
  schema.methods.addAdminNote = function(adminId, note) {
    this.adminNotes.push({ admin: adminId, note });
    this.updatedAt = new Date();
    this.updatedBy = adminId;
    
    // Add to activity log if you have one
    if (this.activityLog) {
      this.activityLog.push({
        action: ACTIVITY_ACTIONS.NOTE_ADDED,
        performedBy: adminId,
        details: `Admin note added: ${note.substring(0, 50)}...`,
        timestamp: new Date()
      });
    }
    
    return this.save();
  };
  
  // Assign to admin
  schema.methods.assignTo = function(adminId) {
    const oldAssignee = this.assignedTo;
    this.assignedTo = adminId;
    this.updatedBy = adminId;
    this.updatedAt = new Date();
    
    // Add to activity log if you have one
    if (this.activityLog) {
      this.activityLog.push({
        action: ACTIVITY_ACTIONS.ASSIGNED,
        performedBy: adminId,
        details: `Assigned from ${oldAssignee || 'unassigned'} to ${adminId}`,
        timestamp: new Date()
      });
    }
    
    return this.save();
  };
  
  // Mark as read
  schema.methods.markAsRead = function(userId) {
    this.isRead = true;
    this.updatedBy = userId;
    this.updatedAt = new Date();
    
    if (this.activityLog) {
      this.activityLog.push({
        action: ACTIVITY_ACTIONS.MARKED_READ,
        performedBy: userId,
        timestamp: new Date()
      });
    }
    
    return this.save();
  };
  
  // Update status
  schema.methods.updateStatus = function(newStatus, userId, resolutionNotes = '') {
    const oldStatus = this.status;
    this.status = newStatus;
    this.updatedBy = userId;
    this.updatedAt = new Date();
    
    if (newStatus === CONTACT_STATUS.RESOLVED || newStatus === CONTACT_STATUS.CLOSED) {
      this.resolvedAt = new Date();
      if (resolutionNotes) {
        this.resolutionNotes = resolutionNotes;
      }
    }
    
    // If reopening a resolved ticket
    if (oldStatus === CONTACT_STATUS.RESOLVED && 
        (newStatus === CONTACT_STATUS.OPEN || newStatus === CONTACT_STATUS.IN_PROGRESS)) {
      this.resolvedAt = null;
      
      if (this.activityLog) {
        this.activityLog.push({
          action: ACTIVITY_ACTIONS.REOPENED,
          performedBy: userId,
          details: `Ticket reopened from ${oldStatus} to ${newStatus}`,
          timestamp: new Date()
        });
      }
    }
    
    // Add to activity log
    if (this.activityLog) {
      this.activityLog.push({
        action: ACTIVITY_ACTIONS.STATUS_CHANGED,
        performedBy: userId,
        details: `Status changed from ${oldStatus} to ${newStatus}`,
        timestamp: new Date()
      });
    }
    
    return this.save();
  };
  
  // Archive contact
  schema.methods.archive = function(userId) {
    this.isArchived = true;
    this.updatedBy = userId;
    this.updatedAt = new Date();
    
    if (this.activityLog) {
      this.activityLog.push({
        action: ACTIVITY_ACTIONS.ARCHIVED,
        performedBy: userId,
        timestamp: new Date()
      });
    }
    
    return this.save();
  };
  
  // Unarchive contact
  schema.methods.unarchive = function(userId) {
    this.isArchived = false;
    this.updatedBy = userId;
    this.updatedAt = new Date();
    return this.save();
  };
  
  // Add attachment
  schema.methods.addAttachment = function(attachmentData) {
    this.attachments.push({
      ...attachmentData,
      uploadedAt: new Date()
    });
    return this.save();
  };
  
  // Remove attachment
  schema.methods.removeAttachment = function(attachmentUrl) {
    this.attachments = this.attachments.filter(att => att.url !== attachmentUrl);
    return this.save();
  };
  
  // Add tags
  schema.methods.addTags = function(tags, userId) {
    const newTags = Array.isArray(tags) ? tags : [tags];
    newTags.forEach(tag => {
      if (!this.tags.includes(tag)) {
        this.tags.push(tag);
      }
    });
    this.updatedBy = userId;
    this.updatedAt = new Date();
    return this.save();
  };
  
  // Remove tags
  schema.methods.removeTags = function(tags, userId) {
    const removeTags = Array.isArray(tags) ? tags : [tags];
    this.tags = this.tags.filter(tag => !removeTags.includes(tag));
    this.updatedBy = userId;
    this.updatedAt = new Date();
    return this.save();
  };
  
  // Set follow-up date
  schema.methods.setFollowUpDate = function(date, userId) {
    this.followUpDate = date;
    this.updatedBy = userId;
    this.updatedAt = new Date();
    return this.save();
  };
  
  // Get contact summary
  schema.methods.getSummary = function() {
    return {
      id: this._id,
      requestID: this.requestID,
      subject: this.subject,
      status: this.status,
      priority: this.priority,
      category: this.category,
      createdAt: this.createdAt,
      user: this.user,
      assignedTo: this.assignedTo,
      isRead: this.isRead,
      isArchived: this.isArchived,
      hasAttachments: this.attachments?.length > 0,
      noteCount: this.adminNotes?.length || 0,
      lastUpdated: this.updatedAt
    };
  };
  
  // Get full details with populated fields
  schema.methods.getDetails = async function() {
    await this.populate('user', 'username displayName email avatar')
                .populate('assignedTo', 'username displayName email')
                .populate('adminNotes.admin', 'username displayName')
                .execPopulate();
    
    return this;
  };
  
  // Check if contact is overdue for follow-up
  schema.methods.isFollowUpOverdue = function() {
    if (!this.followUpDate) return false;
    return new Date() > this.followUpDate && 
           this.status !== CONTACT_STATUS.RESOLVED && 
           this.status !== CONTACT_STATUS.CLOSED;
  };
  
  // Get time since creation
  schema.methods.getAge = function() {
    const now = new Date();
    const diffMs = now - this.createdAt;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return {
      days: diffDays,
      hours: diffHours,
      totalHours: Math.floor(diffMs / (1000 * 60 * 60)),
      formatted: `${diffDays}d ${diffHours}h`
    };
  };
};