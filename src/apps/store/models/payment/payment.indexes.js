export const setupPaymentIndexes = (schema) => {
  // Unique indexes
  schema.index({ transactionReference: 1 }, { unique: true });
  schema.index({ gatewayReference: 1 }, { unique: true, sparse: true });
  schema.index({ refundReference: 1 }, { unique: true, sparse: true });
  
  // Foreign key indexes
  schema.index({ order: 1 });
  schema.index({ store: 1 });
  schema.index({ customer: 1 });
  
  // Status indexes
  schema.index({ status: 1 });
  schema.index({ status: 1, createdAt: -1 });
  schema.index({ paymentGateway: 1, status: 1 });
  
  // Date range indexes
  schema.index({ initiatedAt: -1 });
  schema.index({ completedAt: -1 });
  schema.index({ initiatedAt: 1, status: 1 });
  
  // Webhook indexes
  schema.index({ webhookReceived: 1, initiatedAt: 1 });
  schema.index({ webhookReceived: 1, status: 1 });
  
  // Refund indexes
  schema.index({ refundedAt: -1 });
  schema.index({ refundReference: 1 });
  
  // Compound indexes for analytics
  schema.index({ store: 1, status: 1, initiatedAt: -1 });
  schema.index({ customer: 1, status: 1, initiatedAt: -1 });
  schema.index({ paymentGateway: 1, initiatedAt: -1 });
  schema.index({ paymentChannel: 1, initiatedAt: -1 });
  
  // Amount range queries
  schema.index({ amount: 1, status: 1 });
  
  // Customer info indexes
  schema.index({ customerEmail: 1 });
  schema.index({ customerPhone: 1 });
};