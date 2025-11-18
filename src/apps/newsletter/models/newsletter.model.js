import mongoose from 'mongoose';

// Schema for tracking email opens and clicks
const engagementSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true 
  },
  opened: { 
    type: Boolean, 
    default: false 
  },
  openedAt: { 
    type: Date 
  },
  openCount: { 
    type: Number, 
    default: 0 
  },
  clicked: { 
    type: Boolean, 
    default: false 
  },
  clickedAt: { 
    type: Date 
  },
  clickCount: { 
    type: Number, 
    default: 0 
  },
  clickedLinks: [{
    url: String,
    clickedAt: Date,
    clickCount: Number
  }],
  deviceInfo: {
    userAgent: String,
    ipAddress: String,
    platform: String,
    browser: String
  }
}, { _id: false });

// Schema for tracking delivery status
const deliveryStatusSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true 
  },
  status: { 
    type: String, 
    enum: [
      'pending',
      'sent',
      'delivered',
      'bounced',
      'complained',
      'failed'
    ],
    default: 'pending'
  },
  messageId: String, // Email service provider message ID
  deliveredAt: Date,
  bouncedAt: Date,
  bounceReason: String,
  complaintAt: Date,
  failureReason: String,
  serviceProvider: String // e.g., 'sendgrid', 'mailgun', 'ses'
}, { _id: false });

// Schema for newsletter content versions (for A/B testing or edits)
const contentVersionSchema = new mongoose.Schema({
  version: { 
    type: Number, 
    default: 1 
  },
  subject: { 
    type: String, 
    required: true,
    trim: true 
  },
  previewText: { 
    type: String, 
    trim: true,
    maxlength: 150 
  },
  content: { 
    type: String, 
    required: true 
  },
  htmlContent: String, // Rendered HTML version
  plainTextContent: String, // Plain text fallback
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { _id: false });

const newsletterSchema = new mongoose.Schema(
  {
    // Basic identification
    title: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 200 
    },
    subject: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 150 
    },
    previewText: { 
      type: String, 
      trim: true,
      maxlength: 150 
    },

    // Content
    content: { 
      type: String, 
      required: true 
    },
    htmlContent: { 
      type: String 
    }, // Auto-generated HTML version
    plainTextContent: { 
      type: String 
    }, // Auto-generated plain text version
    
    // Content versions for history tracking
    contentVersions: [contentVersionSchema],
    currentVersion: { 
      type: Number, 
      default: 1 
    },

    // Recipient configuration
    recipientType: { 
      type: String, 
      enum: ['all', 'marketers', 'promoters', 'external'],
      required: true 
    },
    externalEmails: [{
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"]
    }],
    estimatedRecipients: { 
      type: Number, 
      default: 0 
    },
    actualRecipients: { 
      type: Number, 
      default: 0 
    },

    // Scheduling and status
    status: { 
      type: String, 
      enum: ['draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'],
      default: 'draft' 
    },
    sendOption: { 
      type: String, 
      enum: ['draft', 'now', 'schedule'],
      default: 'draft' 
    },
    scheduledDate: { 
      type: Date 
    },
    sentDate: { 
      type: Date 
    },

    // Tracking and analytics
    engagement: [engagementSchema],
    deliveryStatus: [deliveryStatusSchema],
    
    // Performance metrics
    openRate: { 
      type: Number, 
      default: 0 
    }, // Percentage
    clickRate: { 
      type: Number, 
      default: 0 
    }, // Percentage
    totalOpens: { 
      type: Number, 
      default: 0 
    },
    totalClicks: { 
      type: Number, 
      default: 0 
    },
    uniqueOpens: { 
      type: Number, 
      default: 0 
    },
    uniqueClicks: { 
      type: Number, 
      default: 0 
    },
    bounceRate: { 
      type: Number, 
      default: 0 
    },
    complaintRate: { 
      type: Number, 
      default: 0 
    },
    unsubscribes: { 
      type: Number, 
      default: 0 
    },

    // Campaign tracking
    campaignId: { 
      type: String 
    }, // For grouping related newsletters
    tags: [{ 
      type: String, 
      trim: true 
    }],

    // Creator and ownership
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    updatedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },

    // System flags
    isActive: { 
      type: Boolean, 
      default: true 
    },
    isDeleted: { 
      type: Boolean, 
      default: false 
    },
    deletedAt: { 
      type: Date 
    },

    // Email service integration
    serviceProvider: { 
      type: String, 
      default: 'sendgrid' 
    }, // or 'mailgun', 'ses', etc.
    templateId: String, // External template ID if using templates
    messageId: String, // External message ID from email service

    // A/B testing (optional)
    abTest: {
      isVariation: { type: Boolean, default: false },
      parentNewsletter: { type: mongoose.Schema.Types.ObjectId, ref: 'Newsletter' },
      variationType: { type: String, enum: ['subject', 'content', 'both'] },
      winner: { type: Boolean } // Mark if this variation won the test
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for total recipients
newsletterSchema.virtual('totalRecipients').get(function() {
  if (this.recipientType === 'external') {
    return this.externalEmails ? this.externalEmails.length : 0;
  }
  return this.actualRecipients || this.estimatedRecipients;
});

// Indexes for performance
newsletterSchema.index({ status: 1, scheduledDate: 1 });
newsletterSchema.index({ createdBy: 1, createdAt: -1 });
newsletterSchema.index({ recipientType: 1 });
newsletterSchema.index({ scheduledDate: 1 });
newsletterSchema.index({ 'engagement.email': 1 });
newsletterSchema.index({ campaignId: 1 });
newsletterSchema.index({ tags: 1 });
newsletterSchema.index({ isDeleted: 1 });

// Instance methods
newsletterSchema.methods = {
  // Track email open
  trackOpen(email, deviceInfo = {}) {
    let engagement = this.engagement.find(e => e.email === email);
    
    if (!engagement) {
      engagement = { email, opened: true, openedAt: new Date(), openCount: 1, deviceInfo };
      this.engagement.push(engagement);
    } else {
      engagement.opened = true;
      engagement.openCount += 1;
      if (!engagement.openedAt) {
        engagement.openedAt = new Date();
      }
      engagement.deviceInfo = deviceInfo;
    }
    
    this.totalOpens += 1;
    this.uniqueOpens = this.engagement.filter(e => e.opened).length;
    this.openRate = this.totalRecipients > 0 ? (this.uniqueOpens / this.totalRecipients) * 100 : 0;
    
    return this.save();
  },

  // Track link click
  trackClick(email, url, deviceInfo = {}) {
    let engagement = this.engagement.find(e => e.email === email);
    
    if (!engagement) {
      engagement = { 
        email, 
        clicked: true, 
        clickedAt: new Date(), 
        clickCount: 1,
        clickedLinks: [{ url, clickedAt: new Date(), clickCount: 1 }],
        deviceInfo 
      };
      this.engagement.push(engagement);
    } else {
      engagement.clicked = true;
      engagement.clickCount += 1;
      if (!engagement.clickedAt) {
        engagement.clickedAt = new Date();
      }
      engagement.deviceInfo = deviceInfo;
      
      // Track specific link click
      const link = engagement.clickedLinks.find(l => l.url === url);
      if (link) {
        link.clickCount += 1;
        link.clickedAt = new Date();
      } else {
        engagement.clickedLinks.push({ url, clickedAt: new Date(), clickCount: 1 });
      }
    }
    
    this.totalClicks += 1;
    this.uniqueClicks = this.engagement.filter(e => e.clicked).length;
    this.clickRate = this.totalRecipients > 0 ? (this.uniqueClicks / this.totalRecipients) * 100 : 0;
    
    return this.save();
  },

  // Update delivery status
  updateDeliveryStatus(email, status, additionalData = {}) {
    let delivery = this.deliveryStatus.find(d => d.email === email);
    
    if (!delivery) {
      delivery = { email, status, ...additionalData };
      this.deliveryStatus.push(delivery);
    } else {
      delivery.status = status;
      Object.assign(delivery, additionalData);
    }
    
    // Update bounce/complaint rates
    if (status === 'bounced') {
      this.bounceRate = this.deliveryStatus.filter(d => d.status === 'bounced').length / this.totalRecipients * 100;
    }
    
    if (status === 'complained') {
      this.complaintRate = this.deliveryStatus.filter(d => d.status === 'complained').length / this.totalRecipients * 100;
    }
    
    return this.save();
  },

  // Create new content version
  createContentVersion(createdBy) {
    const newVersion = {
      version: this.currentVersion + 1,
      subject: this.subject,
      previewText: this.previewText,
      content: this.content,
      htmlContent: this.htmlContent,
      plainTextContent: this.plainTextContent,
      createdAt: new Date(),
      createdBy
    };
    
    this.contentVersions.push(newVersion);
    this.currentVersion += 1;
    
    return this.save();
  },

  // Restore content from version
  restoreContentVersion(versionNumber) {
    const version = this.contentVersions.find(v => v.version === versionNumber);
    if (!version) {
      throw new Error(`Version ${versionNumber} not found`);
    }
    
    this.subject = version.subject;
    this.previewText = version.previewText;
    this.content = version.content;
    this.htmlContent = version.htmlContent;
    this.plainTextContent = version.plainTextContent;
    
    return this.save();
  },

  // Soft delete
  softDelete() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
  },

  // Restore from soft delete
  restore() {
    this.isDeleted = false;
    this.deletedAt = null;
    return this.save();
  },

  // Get performance summary
  getPerformanceSummary() {
    return {
      totalRecipients: this.totalRecipients,
      sentDate: this.sentDate,
      openRate: this.openRate,
      clickRate: this.clickRate,
      totalOpens: this.totalOpens,
      totalClicks: this.totalClicks,
      uniqueOpens: this.uniqueOpens,
      uniqueClicks: this.uniqueClicks,
      bounceRate: this.bounceRate,
      complaintRate: this.complaintRate,
      unsubscribes: this.unsubscribes
    };
  }
};

// Static methods
newsletterSchema.statics = {
  // Find active newsletters
  findActive() {
    return this.find({ isActive: true, isDeleted: false });
  },

  // Find by status
  findByStatus(status) {
    return this.find({ status, isDeleted: false });
  },

  // Find scheduled newsletters that need to be sent
  findScheduledForSending() {
    const now = new Date();
    return this.find({
      status: 'scheduled',
      scheduledDate: { $lte: now },
      isDeleted: false
    });
  },

  // Get newsletter statistics
  async getStats() {
    const stats = await this.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          scheduled: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
          sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          totalSent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, '$actualRecipients', 0] } },
          avgOpenRate: { $avg: '$openRate' },
          avgClickRate: { $avg: '$clickRate' }
        }
      }
    ]);
    
    return stats[0] || {
      total: 0,
      draft: 0,
      scheduled: 0,
      sent: 0,
      totalSent: 0,
      avgOpenRate: 0,
      avgClickRate: 0
    };
  },

  // Get recipient counts by type
  async getRecipientCounts() {
    const UserModel = mongoose.model('User');
    
    const [allUsers, marketers, promoters] = await Promise.all([
      UserModel.countDocuments({ isActive: true, isDeleted: false }),
      UserModel.countDocuments({ role: 'marketer', isActive: true, isDeleted: false }),
      UserModel.countDocuments({ role: 'promoter', isActive: true, isDeleted: false })
    ]);
    
    return {
      all: allUsers,
      marketers,
      promoters
    };
  },

  // Find newsletters with best performance
  findTopPerformers(limit = 10) {
    return this.find({ 
      status: 'sent', 
      isDeleted: false 
    })
    .sort({ openRate: -1, clickRate: -1 })
    .limit(limit);
  },

  // Clean up old soft-deleted newsletters (older than 30 days)
  async cleanupOldDeleted() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return this.deleteMany({
      isDeleted: true,
      deletedAt: { $lt: thirtyDaysAgo }
    });
  }
};

// Middleware
newsletterSchema.pre('save', function(next) {
  // Auto-generate HTML and plain text content if not provided
  if (this.isModified('content') && this.content) {
    if (!this.htmlContent) {
      // Basic HTML conversion - you might want to use a proper markdown or rich text parser
      this.htmlContent = this.content
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }
    
    if (!this.plainTextContent) {
      // Strip HTML tags and basic formatting for plain text
      this.plainTextContent = this.content
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1');
    }
  }
  
  // Set actual recipients based on recipient type
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
  }
  
  next();
});

// Compound index for efficient queries
newsletterSchema.index({ createdAt: -1, status: 1 });
newsletterSchema.index({ scheduledDate: 1, status: 1 });

export const NewsletterModel = mongoose.model('Newsletter', newsletterSchema);