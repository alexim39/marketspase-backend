import mongoose from 'mongoose';

const campaignTemplateSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  data: {
    title: String,
    caption: String,
    category: String,
    promotionGoal: String,
    budget: Number,
    currency: String,
    mediaUrl: String,
    mediaType: String,
    link: String,
    targetCountries: [String],
    targetAudience: String,
    ppcPrice: Number,
  },
  useCount: { type: Number, default: 0 },
}, { timestamps: true });

export const CampaignTemplateModel = mongoose.model('CampaignTemplate', campaignTemplateSchema);
