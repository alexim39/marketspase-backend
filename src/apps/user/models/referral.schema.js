import mongoose from 'mongoose';

// Add to user.model.js
export const referralSchema = new mongoose.Schema({
  referrerUsername: { type: String, required: true },
  refereeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  refereeRole: { type: String, enum: ['marketer', 'promoter'], required: true },
  bonusAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'qualified', 'paid', 'cancelled'], 
    default: 'pending' 
  },
  qualifiedAt: { type: Date },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Optional: Create and export the Referral model as well
//export const ReferralModel = mongoose.model('Referral', referralSchema);