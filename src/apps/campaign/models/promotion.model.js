import mongoose from "mongoose";

// Function to generate a unique 6-digit number
const generateUniqueUpi = () => {
  const min = 100000;
  const max = 999999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const promotionSchema = new mongoose.Schema({
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campaign",
    required: true,
  },
  promoter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "submitted", "validated", "rejected", "paid"],
    default: "pending",
  },
  submittedAt: Date,
  validatedAt: Date,
  paidAt: Date,
  proofMedia: [String], // URLs to proof screenshots
  proofViews: {
    type: Number,
    min: 0,
    validate: {
      validator: function(value) {
        // Only require proofViews when status is submitted or beyond
        return this.status === "pending" || value !== undefined;
      },
      message: "Proof views are required when promotion is submitted"
    }
  },
  payoutAmount: {
    type: Number,
    min: 0
  },
  rejectionReason: String,
  notes: String,
  isDownloaded: {
    type: Boolean,
    default: false,
  },
  upi: {
    type: String,
    unique: true,
    default: function() {
      // Ensure we're generating a new UPI only for new documents
      if (this.isNew) {
        return generateUniqueUpi().toString();
      }
      return this.upi;
    }
  },
  // Additional fields for better tracking
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  // Activity log for tracking changes
  activityLog: [{
    action: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  }]
}, { 
  timestamps: true,
  // Virtuals for toJSON and toObject
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index to prevent duplicate applications
promotionSchema.index({ campaign: 1, promoter: 1 }, { unique: true });

// Index for better query performance
promotionSchema.index({ status: 1 });
promotionSchema.index({ promoter: 1, status: 1 });
promotionSchema.index({ campaign: 1, status: 1 });
promotionSchema.index({ upi: 1 });

// Virtual for days since submission
promotionSchema.virtual('daysSinceSubmission').get(function() {
  if (!this.submittedAt) return null;
  const now = new Date();
  const diffTime = Math.abs(now - this.submittedAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for isOverdue (if not validated within 7 days)
promotionSchema.virtual('isOverdue').get(function() {
  if (!this.submittedAt || this.status === 'validated' || this.status === 'rejected') {
    return false;
  }
  const now = new Date();
  const diffTime = Math.abs(now - this.submittedAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 7;
});

// Pre-save middleware to update timestamps based on status changes
promotionSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    
    if (this.status === 'submitted' && !this.submittedAt) {
      this.submittedAt = now;
      this.activityLog.push({
        action: 'Promotion Submitted',
        details: 'Promoter submitted proof for validation',
        timestamp: now
      });
    }
    
    if (this.status === 'validated' && !this.validatedAt) {
      this.validatedAt = now;
      this.activityLog.push({
        action: 'Promotion Validated',
        details: 'Promotion validated and approved for payment',
        timestamp: now
      });
    }
    
    if (this.status === 'paid' && !this.paidAt) {
      this.paidAt = now;
      this.activityLog.push({
        action: 'Promotion Paid',
        details: 'Payment processed successfully',
        timestamp: now
      });
    }
    
    if (this.status === 'rejected') {
      this.activityLog.push({
        action: 'Promotion Rejected',
        details: this.rejectionReason ? `Rejected: ${this.rejectionReason}` : 'Promotion rejected',
        timestamp: now
      });
    }
  }
  next();
});

// Static method to find promotions by status
promotionSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

// Instance method to validate promotion
promotionSchema.methods.validatePromotion = function(validatedByUserId) {
  this.status = 'validated';
  this.validatedAt = new Date();
  this.validatedBy = validatedByUserId;
  return this;
};

// Instance method to reject promotion
promotionSchema.methods.rejectPromotion = function(reason, rejectedByUserId) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.activityLog.push({
    action: 'Promotion Rejected',
    details: reason,
    performedBy: rejectedByUserId,
    timestamp: new Date()
  });
  return this;
};

// Instance method to mark as paid
promotionSchema.methods.markAsPaid = function(paidByUserId) {
  this.status = 'paid';
  this.paidAt = new Date();
  this.paidBy = paidByUserId;
  return this;
};

export const PromotionModel = mongoose.model("Promotion", promotionSchema);





/* import mongoose from "mongoose";

// Function to generate a unique 6-digit number
const generateUniqueUpi = () => {
  // Generate a random 6-digit number
  const min = 100000;
  const max = 999999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const promotionSchema = new mongoose.Schema({
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campaign",
    required: true,
  },
  promoter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "submitted", "validated", "rejected", "paid"],
    default: "pending",
  },
  submittedAt: Date,
  validatedAt: Date,
  paidAt: Date,
  proofMedia: [String], // URLs to proof screenshots
  proofViews: Number, // Number of views reported by promoter
  payoutAmount: Number,
  rejectionReason: String,
  notes: String,
  isDownloaded: {
    type: Boolean,
    default: false,
  },
  upi: {
    type: String,
    unique: true, // Ensure UPI is unique
    default: () => generateUniqueUpi().toString(),
  },
}, { timestamps: true });

// Index to prevent duplicate applications
promotionSchema.index({ campaign: 1, promoter: 1 }, { unique: true });

export const PromotionModel = mongoose.model("Promotion", promotionSchema); */