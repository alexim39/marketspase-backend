import mongoose from "mongoose";

const promotionTrackingSchema = new mongoose.Schema({
  // References
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Product", 
    required: true,
    index: true 
  },
  promoter: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true 
  },
  store: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true,
    index: true 
  },
  
  // Tracking Identifiers
  uniqueCode: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  uniqueId: { 
    type: String, 
    unique: true,
    index: true 
  },
  
  // Commission Settings
  commissionRate: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100 
  },
  commissionType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  fixedCommission: { type: Number, min: 0 },
  
  // Analytics & Performance
  viewCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  clickCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  conversionCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  earnings: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  
  // Status
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  },
  isApproved: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  
  // Settings
  startDate: { 
    type: Date,
    default: Date.now 
  },
  endDate: { 
    type: Date 
  },
  maxConversions: { 
    type: Number,
    min: 0 
  },
  
  // Performance Metrics
  clickThroughRate: { 
    type: Number,
    default: 0,
    min: 0,
    max: 100 
  },
  conversionRate: { 
    type: Number,
    default: 0,
    min: 0,
    max: 100 
  },
  averageOrderValue: { 
    type: Number,
    default: 0,
    min: 0 
  },
    
  // Tracking Data
  deviceTypes: {
    mobile: { type: Number, default: 0 },
    desktop: { type: Number, default: 0 },
    tablet: { type: Number, default: 0 }
  },
  referralSources: [{
    source: String,
    count: { type: Number, default: 0 }
  }],
  
  // Timestamps & Metadata
  lastActivityAt: { 
    type: Date 
  },
  metadata: {
    campaignName: String,
    notes: String,
    customParams: Map
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export default promotionTrackingSchema;