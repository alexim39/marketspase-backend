import mongoose from "mongoose";

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

export default promoSchema;