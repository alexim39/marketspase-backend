import mongoose from "mongoose";
import {
  TEMPLATE_STATUS_ARRAY,
  DEFAULTS,
  ERROR_MESSAGES,
  VALIDATION
} from "./whatsapp-integration.constants.js";

const whatsAppIntegrationSchema = new mongoose.Schema({
  store: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store",
    required: [true, ERROR_MESSAGES.STORE_REQUIRED],
    unique: true,
    index: true 
  },
  
  templates: [{
    name: { 
      type: String, 
      required: true,
      trim: true,
      minlength: VALIDATION.TEMPLATE_NAME.MIN_LENGTH,
      maxlength: VALIDATION.TEMPLATE_NAME.MAX_LENGTH
    },
    message: { 
      type: String, 
      required: true,
      trim: true,
      minlength: VALIDATION.TEMPLATE_MESSAGE.MIN_LENGTH,
      maxlength: VALIDATION.TEMPLATE_MESSAGE.MAX_LENGTH
    },
    variables: [{
      type: String,
      trim: true
    }],
    isActive: { 
      type: Boolean, 
      default: DEFAULTS.TEMPLATE_IS_ACTIVE 
    },
    status: {
      type: String,
      enum: TEMPLATE_STATUS_ARRAY,
      default: TEMPLATE_STATUS_ARRAY[0] // 'active'
    },
    category: {
      type: String,
      enum: ['marketing', 'order', 'support', 'greeting', 'notification'],
      default: 'marketing'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  quickReplies: [{
    type: String,
    trim: true,
    maxlength: VALIDATION.QUICK_REPLY.MAX_LENGTH
  }],
  
  autoResponses: [{
    trigger: { 
      type: String, 
      required: true,
      trim: true,
      lowercase: true,
      minlength: VALIDATION.AUTO_RESPONSE_TRIGGER.MIN_LENGTH,
      maxlength: VALIDATION.AUTO_RESPONSE_TRIGGER.MAX_LENGTH
    },
    response: { 
      type: String, 
      required: true,
      trim: true,
      minlength: VALIDATION.AUTO_RESPONSE_MESSAGE.MIN_LENGTH,
      maxlength: VALIDATION.AUTO_RESPONSE_MESSAGE.MAX_LENGTH
    },
    isActive: {
      type: Boolean,
      default: true
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    },
    matchType: {
      type: String,
      enum: ['exact', 'contains', 'startsWith'],
      default: 'contains'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Business profile information
  businessProfile: {
    businessName: String,
    businessDescription: String,
    businessHours: String,
    supportPhone: String,
    supportEmail: String,
    website: String,
    address: String
  },
  
  // Webhook settings
  webhook: {
    url: String,
    secret: String,
    isActive: { type: Boolean, default: false }
  },
  
  // Statistics
  stats: {
    messagesSent: { type: Number, default: 0 },
    templatesUsed: { type: Number, default: 0 },
    autoResponsesTriggered: { type: Number, default: 0 },
    quickRepliesUsed: { type: Number, default: 0 }
  },
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export default whatsAppIntegrationSchema;