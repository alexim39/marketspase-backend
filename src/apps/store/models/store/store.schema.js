import mongoose from "mongoose";
import {
  VERIFICATION_TIER_ARRAY,
  STORE_CATEGORY_ARRAY,
  DEFAULTS,
  ERROR_MESSAGES,
  VALIDATION
} from "./store.constants.js";

const storeSchema = new mongoose.Schema({
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: [true, ERROR_MESSAGES.OWNER_REQUIRED],
    index: true 
  },
  
  name: { 
    type: String, 
    required: [true, ERROR_MESSAGES.NAME_REQUIRED],
    trim: true,
    minlength: VALIDATION.NAME.MIN_LENGTH,
    maxlength: VALIDATION.NAME.MAX_LENGTH
  },
  
  description: { 
    type: String, 
    trim: true,
    maxlength: VALIDATION.DESCRIPTION.MAX_LENGTH
  },
  
  logo: { 
    type: String,
    default: null
  },
  
  category: { 
    type: String, 
    enum: STORE_CATEGORY_ARRAY,
    default: STORE_CATEGORY_ARRAY[STORE_CATEGORY_ARRAY.length - 1] // 'other'
  },
  
  isVerified: { 
    type: Boolean, 
    default: DEFAULTS.IS_VERIFIED 
  },
  
  isDefaultStore: { 
    type: Boolean, 
    default: DEFAULTS.IS_DEFAULT_STORE 
  },
  
  verificationTier: { 
    type: String, 
    enum: VERIFICATION_TIER_ARRAY, 
    default: DEFAULTS.VERIFICATION_TIER 
  },
  
  storeLink: { 
    type: String, 
    unique: true, 
    required: [true, ERROR_MESSAGES.STORE_LINK_REQUIRED], 
    trim: true,
    lowercase: true,
    minlength: VALIDATION.STORE_LINK.MIN_LENGTH,
    maxlength: VALIDATION.STORE_LINK.MAX_LENGTH
  },
  
  // Store Analytics
  analytics: {
    totalViews: { type: Number, default: DEFAULTS.ANALYTICS.totalViews, min: 0 },
    totalSales: { type: Number, default: DEFAULTS.ANALYTICS.totalSales, min: 0 },
    conversionRate: { type: Number, default: DEFAULTS.ANALYTICS.conversionRate, min: 0, max: 100 },
    promoterTraffic: { type: Number, default: DEFAULTS.ANALYTICS.promoterTraffic, min: 0 }
  },
  
  // Integration with existing campaign system
  activeCampaigns: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Campaign" 
  }],
  
  storeProducts: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Product" 
  }],
  
  // WhatsApp integration
  whatsappNumber: { 
    type: String,
    trim: true,
    sparse: true
  },
  
  whatsappTemplates: [{
    type: String,
    trim: true
  }],

  // Soft delete
  isDeleted: { 
    type: Boolean, 
    default: DEFAULTS.IS_DELETED,
    index: true 
  },
  deletedAt: { 
    type: Date 
  },
  deletedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  
  isActive: { 
    type: Boolean, 
    default: DEFAULTS.IS_ACTIVE,
    index: true 
  },
  
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true }
  },
  
  // Store settings
  settings: {
    currency: { type: String, default: 'NGN' },
    timezone: { type: String, default: 'Africa/Lagos' },
    autoApproveReviews: { type: Boolean, default: false },
    notifyOnNewOrder: { type: Boolean, default: true }
  },

  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export default storeSchema;