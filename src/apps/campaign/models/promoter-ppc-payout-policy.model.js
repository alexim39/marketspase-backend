import mongoose from 'mongoose';

const promoterPpcPayoutPolicySchema = new mongoose.Schema(
  {
    promoter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    payoutMode: {
      type: String,
      enum: ['fixed'],
      default: 'fixed',
    },
    fixedPayoutPerClick: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'NGN',
      uppercase: true,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
      required: true,
      maxlength: 1000,
    },
    startsAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endsAt: {
      type: Date,
      required: true,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    lastEmailSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

promoterPpcPayoutPolicySchema.index({ enabled: 1, startsAt: 1, endsAt: 1 });

export const PromoterPpcPayoutPolicyModel = mongoose.models.PromoterPpcPayoutPolicy
  || mongoose.model('PromoterPpcPayoutPolicy', promoterPpcPayoutPolicySchema);
