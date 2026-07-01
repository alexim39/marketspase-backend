import mongoose from 'mongoose';

const cartSnapshotSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  email: { type: String, index: true },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variantId: String,
    name: String,
    price: Number,
    quantity: Number,
    image: String,
    trackingCode: String,
    uniqueId: String,
    promoterId: String,
  }],
  trackingCode: String,
  uniqueId: String,
  promoterId: String,
  currency: String,
  totalAmount: Number,
  lastActiveAt: { type: Date, default: Date.now, index: true },
  recoveryEmailSent: { type: Boolean, default: false },
  recoveryEmailSentAt: Date,
  convertedToOrder: { type: Boolean, default: false },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
}, { timestamps: true });

cartSnapshotSchema.index({ lastActiveAt: 1, recoveryEmailSent: 1, convertedToOrder: 1 });

export const CartSnapshotModel = mongoose.model('CartSnapshot', cartSnapshotSchema);
