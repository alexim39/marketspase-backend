import mongoose from 'mongoose';

const servicePackageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  includes: [String],
}, { _id: true });

const serviceSchema = new mongoose.Schema({
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, maxlength: 2000 },
  category: { type: String, required: true },
  pricingType: { type: String, enum: ['fixed', 'hourly', 'package', 'quote'], default: 'fixed', required: true },
  price: { type: Number, min: 0, default: 0 },
  hourlyRate: { type: Number, min: 0 },
  packages: [servicePackageSchema],
  acceptsQuotes: { type: Boolean, default: false },
  media: [{ url: String, type: { type: String, enum: ['image', 'video'] }, thumbnailUrl: String }],
  deliveryTime: { type: String },
  includes: [String],
  location: { city: String, state: String, remote: { type: Boolean, default: false } },
  isActive: { type: Boolean, default: true },
  isPublished: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
  inquiryCount: { type: Number, default: 0 },
  bookingCount: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  portfolio: [{ url: String, caption: String, type: { type: String, enum: ['image', 'video'] } }],
  availability: { type: String, enum: ['available', 'busy', 'away'], default: 'available' },
  slotsPerWeek: { type: Number, default: 10 },
  filledSlots: { type: Number, default: 0 },
  averageResponseTime: { type: Number, default: 0 },
  responseCount: { type: Number, default: 0 },
  affiliate: {
    enabled: { type: Boolean, default: true },
    commissionType: { type: String, enum: ['per_lead', 'per_booking'], default: 'per_lead' },
    leadCommission: { type: Number, default: 200, min: 0 },
    bookingCommissionRate: { type: Number, default: 200, min: 0 },
  },
  subscriptionTier: { type: String, enum: ['free', 'basic', 'pro'], default: 'free', index: true },
  subscriptionExpiresAt: Date,
  promotionStartDate: Date,
  promotionEndDate: Date,
  upi: { type: String, unique: true, sparse: true, index: true },
}, { timestamps: true });

serviceSchema.index({ category: 1, isActive: 1, isPublished: 1, isDeleted: 1 });
serviceSchema.index({ 'affiliate.commissionType': 1 });

serviceSchema.pre('save', function (next) {
  if (!this.upi) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    this.upi = result;
  }
  next();
});

export const ServiceModel = mongoose.model('Service', serviceSchema);
