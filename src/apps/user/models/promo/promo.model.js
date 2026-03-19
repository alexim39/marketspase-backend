import mongoose from "mongoose";
import promoSchema from "./promo.schema.js";
import { setupPromoMethods } from "./promo.methods.js";
import { setupPromoStatics } from "./promo.statics.js";
import { setupPromoIndexes } from "./promo.indexes.js";

// Setup all schema extensions
setupPromoMethods(promoSchema);
setupPromoStatics(promoSchema);
setupPromoIndexes(promoSchema);

export const PromoModel = mongoose.model("Promo", promoSchema);

/* // models/promo.model.js
import mongoose from 'mongoose';

const promoClaimSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  promoId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Promo', 
    required: true 
  },
  claimedAt: { 
    type: Date, 
    default: Date.now 
  },
  creditAmount: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['claimed', 'credited', 'expired', 'cancelled'], 
    default: 'claimed' 
  },
  creditedAt: { 
    type: Date 
  },
  transactionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Transaction' 
  }
}, { timestamps: true });

const promoSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  code: { 
    type: String, 
    unique: true, 
    uppercase: true,
    required: true 
  },
  creditAmount: { 
    type: Number, 
    required: true 
  },
  totalSlots: { 
    type: Number, 
    required: true 
  },
  claimedSlots: { 
    type: Number, 
    default: 0 
  },
  targetRoles: [{ 
    type: String, 
    enum: ['marketer', 'promoter', 'admin'],
    default: 'marketer' 
  }],
  eligibilityCriteria: {
    minRating: { type: Number, default: 0 },
    maxClaimsPerUser: { type: Number, default: 1 },
    requireVerification: { type: Boolean, default: false },
    allowedCountries: [{ type: String }],
    excludedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  status: { 
    type: String, 
    enum: ['active', 'paused', 'completed', 'scheduled', 'expired'], 
    default: 'active' 
  },
  startDate: { 
    type: Date, 
    default: Date.now 
  },
  endDate: { 
    type: Date 
  },
  autoCredit: { 
    type: Boolean, 
    default: true 
  },
  notificationSettings: {
    showBanner: { type: Boolean, default: true },
    bannerMessage: { type: String },
    bannerColor: { type: String, default: '#667eea' }
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }
}, { timestamps: true });

// Indexes for better performance
promoSchema.index({ code: 1 });
promoSchema.index({ status: 1, startDate: 1, endDate: 1 });
promoSchema.index({ targetRoles: 1 });

promoClaimSchema.index({ userId: 1, promoId: 1 }, { unique: true });
promoClaimSchema.index({ status: 1 });

// Instance methods
promoSchema.methods = {
  // Check if promo is active and available
  isActive() {
    const now = new Date();
    return this.status === 'active' && 
           (!this.startDate || this.startDate <= now) && 
           (!this.endDate || this.endDate >= now);
  },

  // Check if user is eligible for this promo
  async isUserEligible(user) {
    if (!this.isActive()) {
      return { eligible: false, reason: 'Promo is not active' };
    }

    if (this.claimedSlots >= this.totalSlots) {
      return { eligible: false, reason: 'All slots have been claimed' };
    }

    if (this.targetRoles.length > 0 && !this.targetRoles.includes(user.role)) {
      return { eligible: false, reason: 'User role not eligible' };
    }

    if (this.eligibilityCriteria.minRating > 0 && user.rating < this.eligibilityCriteria.minRating) {
      return { eligible: false, reason: 'Minimum rating requirement not met' };
    }

    if (this.eligibilityCriteria.requireVerification && !user.isVerified) {
      return { eligible: false, reason: 'Account verification required' };
    }

    if (this.eligibilityCriteria.allowedCountries.length > 0 && user.personalInfo?.address?.country) {
      if (!this.eligibilityCriteria.allowedCountries.includes(user.personalInfo.address.country)) {
        return { eligible: false, reason: 'Country not eligible' };
      }
    }

    if (this.eligibilityCriteria.excludedUsers.includes(user._id)) {
      return { eligible: false, reason: 'User excluded from this promo' };
    }

    // Check if user has already claimed this promo
    const existingClaim = await PromoClaimModel.findOne({ 
      userId: user._id, 
      promoId: this._id 
    });

    if (existingClaim) {
      return { eligible: false, reason: 'You have already claimed this promotional offer' };
    }

    // Check max claims per user
    const userClaimCount = await PromoClaimModel.countDocuments({ 
      userId: user._id, 
      promoId: this._id 
    });

    if (userClaimCount >= this.eligibilityCriteria.maxClaimsPerUser) {
      return { eligible: false, reason: 'Maximum claims reached' };
    }

    return { eligible: true };
  },

  // Get remaining slots
  getRemainingSlots() {
    return Math.max(0, this.totalSlots - this.claimedSlots);
  },

  // Get remaining slots percentage
  getRemainingSlotsPercentage() {
    return (this.getRemainingSlots() / this.totalSlots) * 100;
  }
};

// Static methods
promoSchema.statics = {
  // Find active promos for a specific user role
  async findActivePromosForRole(role) {
    const now = new Date();
    return this.find({
      status: 'active',
      targetRoles: { $in: [role] },
      $or: [
        { startDate: { $exists: false } },
        { startDate: { $lte: now } }
      ],
      $or: [
        { endDate: { $exists: false } },
        { endDate: { $gte: now } }
      ]
    }).sort({ createdAt: -1 });
  },

  // Get promo with remaining slots info
  async getPromoWithSlots(promoId) {
    const promo = await this.findById(promoId);
    if (!promo) return null;

    const remainingSlots = promo.getRemainingSlots();
    const percentage = promo.getRemainingSlotsPercentage();

    return {
      ...promo.toObject(),
      remainingSlots,
      remainingSlotsPercentage: percentage
    };
  }
};

export const PromoModel = mongoose.model('Promo', promoSchema);
export const PromoClaimModel = mongoose.model('PromoClaim', promoClaimSchema); */