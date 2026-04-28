export const setupOrderIndexes = (schema) => {
  // Primary indexes for lookups
  schema.index({ orderNumber: 1 }, { unique: true });
  schema.index({ store: 1, createdAt: -1 });
  schema.index({ customer: 1, createdAt: -1 });
  
  // Status indexes for filtering
  schema.index({ orderStatus: 1, createdAt: -1 });
  schema.index({ paymentStatus: 1, createdAt: -1 });
  schema.index({ orderStatus: 1, paymentStatus: 1 });
  
  // Date range indexes
  schema.index({ placedAt: -1 });
  schema.index({ placedAt: 1, store: 1 });
  
  // Commission tracking indexes
  schema.index({ commissionPaid: 1, totalPromoterCommission: 1 });
  schema.index({ 'items.promoterId': 1, createdAt: -1 });
  schema.index({ 'items.promotionTrackingId': 1 });
  
  // Payment reference indexes
  schema.index({ paymentReference: 1 }, { sparse: true });
  
  // Soft delete index
  schema.index({ isDeleted: 1, createdAt: -1 });
  
  // Compound indexes for analytics
  schema.index({ store: 1, placedAt: -1, paymentStatus: 1 });
  schema.index({ store: 1, orderStatus: 1, placedAt: -1 });
  schema.index({ customer: 1, orderStatus: 1, placedAt: -1 });
  
  // Shipping tracking
  schema.index({ trackingNumber: 1 }, { sparse: true });
  
  // Text search
  schema.index({ orderNumber: 'text', 'customer.email': 'text' });
};