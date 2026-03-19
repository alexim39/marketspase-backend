import mongoose from "mongoose";
import engagementSchema from "./schemas/engagement.schema.js";
import deliveryStatusSchema from "./schemas/delivery-status.schema.js";
import contentVersionSchema from "./schemas/content-version.schema.js";
import abTestSchema from "./schemas/ab-test.schema.js";
import {
  NEWSLETTER_STATUS_ARRAY,
  SEND_OPTION_ARRAY,
  RECIPIENT_TYPE_ARRAY,
  SERVICE_PROVIDER_ARRAY,
  DEFAULTS,
  VALIDATION,
  ERROR_MESSAGES
} from "./newsletter.constants.js";

const newsletterSchema = new mongoose.Schema(
  {
    // Basic identification
    title: { 
      type: String, 
      required: [true, ERROR_MESSAGES.TITLE_REQUIRED],
      trim: true,
      maxlength: [VALIDATION.TITLE.MAX_LENGTH, ERROR_MESSAGES.TITLE_TOO_LONG]
    },
    subject: { 
      type: String, 
      required: [true, ERROR_MESSAGES.SUBJECT_REQUIRED],
      trim: true,
      maxlength: [VALIDATION.SUBJECT.MAX_LENGTH, ERROR_MESSAGES.SUBJECT_TOO_LONG]
    },
    previewText: { 
      type: String, 
      trim: true,
      maxlength: VALIDATION.PREVIEW_TEXT.MAX_LENGTH
    },

    // Content
    content: { 
      type: String, 
      required: [true, ERROR_MESSAGES.CONTENT_REQUIRED]
    },
    htmlContent: { 
      type: String 
    },
    plainTextContent: { 
      type: String 
    },
    
    // Content versions for history tracking
    contentVersions: [contentVersionSchema],
    currentVersion: { 
      type: Number, 
      default: DEFAULTS.CURRENT_VERSION
    },

    // Recipient configuration
    recipientType: { 
      type: String, 
      enum: RECIPIENT_TYPE_ARRAY,
      required: [true, ERROR_MESSAGES.RECIPIENT_TYPE_REQUIRED],
      default: DEFAULTS.RECIPIENT_TYPE
    },
    externalEmails: [{
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: (email) => VALIDATION.EMAIL.PATTERN.test(email),
        message: ERROR_MESSAGES.INVALID_EMAIL
      }
    }],
    estimatedRecipients: { 
      type: Number, 
      default: DEFAULTS.ESTIMATED_RECIPIENTS
    },
    actualRecipients: { 
      type: Number, 
      default: DEFAULTS.ACTUAL_RECIPIENTS
    },

    // Scheduling and status
    status: { 
      type: String, 
      enum: NEWSLETTER_STATUS_ARRAY,
      default: DEFAULTS.STATUS,
      index: true
    },
    sendOption: { 
      type: String, 
      enum: SEND_OPTION_ARRAY,
      default: DEFAULTS.SEND_OPTION
    },
    scheduledDate: { 
      type: Date,
      index: true
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
      default: DEFAULTS.OPEN_RATE 
    },
    clickRate: { 
      type: Number, 
      default: DEFAULTS.CLICK_RATE 
    },
    totalOpens: { 
      type: Number, 
      default: DEFAULTS.TOTAL_OPENS 
    },
    totalClicks: { 
      type: Number, 
      default: DEFAULTS.TOTAL_CLICKS 
    },
    uniqueOpens: { 
      type: Number, 
      default: DEFAULTS.UNIQUE_OPENS 
    },
    uniqueClicks: { 
      type: Number, 
      default: DEFAULTS.UNIQUE_CLICKS 
    },
    bounceRate: { 
      type: Number, 
      default: DEFAULTS.BOUNCE_RATE 
    },
    complaintRate: { 
      type: Number, 
      default: DEFAULTS.COMPLAINT_RATE 
    },
    unsubscribes: { 
      type: Number, 
      default: DEFAULTS.UNSUBSCRIBES 
    },

    // Campaign tracking
    campaignId: { 
      type: String,
      index: true
    },
    tags: [{ 
      type: String, 
      trim: true,
      index: true
    }],

    // Creator and ownership
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: [true, ERROR_MESSAGES.CREATED_BY_REQUIRED],
      index: true
    },
    updatedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },

    // System flags
    isActive: { 
      type: Boolean, 
      default: DEFAULTS.IS_ACTIVE 
    },
    isDeleted: { 
      type: Boolean, 
      default: DEFAULTS.IS_DELETED,
      index: true
    },
    deletedAt: { 
      type: Date 
    },

    // Email service integration
    serviceProvider: { 
      type: String, 
      enum: SERVICE_PROVIDER_ARRAY,
      default: DEFAULTS.SERVICE_PROVIDER
    },
    templateId: String,
    messageId: String,

    // A/B testing
    abTest: { type: abTestSchema, default: () => ({}) }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

export default newsletterSchema;