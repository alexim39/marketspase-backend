import mongoose from 'mongoose';

const smsHistorySchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  message: { type: String, required: true },
  messageLength: { type: Number },
  pageCount: { type: Number, default: 1 },
  costPerPage: { type: Number },
  totalCost: { type: Number },
  status: { type: String, enum: ['sent', 'failed', 'delivered', 'undelivered'], default: 'sent' },
  provider: { type: String, default: 'bulksmsnigeria' },
  providerMessageId: { type: String },
  phone: { type: String, required: true },
  contactName: { type: String },
}, { timestamps: true });

smsHistorySchema.index({ sender: 1, createdAt: -1 });
smsHistorySchema.index({ createdAt: -1 });
smsHistorySchema.index({ status: 1 });

export const SmsHistoryModel = mongoose.model('SmsHistory', smsHistorySchema);
