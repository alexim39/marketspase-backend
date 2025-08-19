import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ['deposit', 'withdrawal', 'ad_payment', 'payout'],
      required: true
    },
    relatedCampaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    relatedPromotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' },
    status: {
      type: String,
      enum: ['pending', 'successful', 'failed'],
      default: 'pending'
    },
    description: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const TransactionModel = mongoose.model('Transaction', transactionSchema);
