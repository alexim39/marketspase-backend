import mongoose from 'mongoose';

const campaignPpcConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'default',
    unique: true,
    index: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  currency: {
    type: String,
    default: 'NGN',
    uppercase: true,
    trim: true,
  },
  defaultCostPerClick: {
    type: Number,
    default: 80,
    min: 1,
  },
  minCostPerClick: {
    type: Number,
    default: 20,
    min: 1,
  },
  maxCostPerClick: {
    type: Number,
    default: 500,
    min: 1,
  },
  allowMarketerOverride: {
    type: Boolean,
    default: false,
  },
  changeReason: {
    type: String,
    trim: true,
    default: '',
    maxlength: 500,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
}, {
  timestamps: true,
});

campaignPpcConfigSchema.index({ updatedAt: -1 });

export const CampaignPpcConfigModel = mongoose.models.CampaignPpcConfig
  || mongoose.model('CampaignPpcConfig', campaignPpcConfigSchema);
