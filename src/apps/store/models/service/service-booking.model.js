import mongoose from 'mongoose';

const serviceBookingSchema = new mongoose.Schema({
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: String,
  customerPhone: String,
  promoter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  promotionTracking: { type: mongoose.Schema.Types.ObjectId, ref: 'PromotionTracking' },
  inquiry: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceInquiry' },
  amount: { type: Number, required: true },
  commissionEarned: { type: Number, default: 0 },
  platformFee: { type: Number, default: 0 },
  status: { type: String, enum: ['confirmed', 'in_progress', 'delivered', 'completed', 'cancelled'], default: 'confirmed', index: true },
  escrowStatus: { type: String, enum: ['pending', 'held', 'released', 'refunded'], default: 'pending' },
  scheduledDate: Date,
  completedAt: Date,
}, { timestamps: true });

export const ServiceBookingModel = mongoose.model('ServiceBooking', serviceBookingSchema);
