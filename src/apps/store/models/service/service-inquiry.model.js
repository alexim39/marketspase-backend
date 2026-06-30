import mongoose from 'mongoose';

const serviceInquirySchema = new mongoose.Schema({
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
  },
  promoter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  promotionTracking: { type: mongoose.Schema.Types.ObjectId, ref: 'PromotionTracking' },
  message: { type: String, maxlength: 1000 },
  budget: String,
  timeline: String,
  status: { type: String, enum: ['new', 'contacted', 'booked', 'closed', 'archived'], default: 'new', index: true },
  leadCommissionPaid: { type: Boolean, default: false },
  leadCommissionAmount: { type: Number, default: 0 },
  convertedToCustomer: { type: Boolean, default: false },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreCustomer' },
}, { timestamps: true });

serviceInquirySchema.index({ provider: 1, status: 1 });
serviceInquirySchema.index({ promoter: 1, createdAt: -1 });

export const ServiceInquiryModel = mongoose.model('ServiceInquiry', serviceInquirySchema);
