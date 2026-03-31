import mongoose from "mongoose";

export const referralSchema = new mongoose.Schema({
  referredUser: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  username: String,
  role: String,
  status: {
    type: String,
    enum: ['pending', 'active', 'converted', 'expired', 'paid'],
    default: 'pending'
  },
  signedUpAt: Date,
  qualifiedAt: Date,
  bonusPaidAt: Date,
  bonusAmount: Number,
  qualifiedAs: {
    type: String,
    enum: ['marketer', 'promoter', 'both']
  }
}, { timestamps: true });