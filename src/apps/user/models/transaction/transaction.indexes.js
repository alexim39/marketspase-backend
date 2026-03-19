export const setupTransactionIndexes = (schema) => {
  // Single field indexes
  schema.index({ reference: 1 });
  schema.index({ status: 1 });
  schema.index({ createdAt: -1 });
  schema.index({ updatedAt: -1 });
  
  // Compound indexes for common queries
  schema.index({ status: 1, createdAt: -1 });
  schema.index({ category: 1, status: 1, createdAt: -1 });
  schema.index({ type: 1, status: 1, createdAt: -1 });
  
  // Indexes for related fields
  schema.index({ relatedCampaign: 1, createdAt: -1 });
  schema.index({ relatedPromotion: 1, createdAt: -1 });
  
  // Index for gateway queries
  schema.index({ gateway: 1, status: 1, createdAt: -1 });
  
  // Index for date range queries
  schema.index({ createdAt: 1, status: 1 });
  
  // Partial index for successful transactions
  schema.index(
    { processedAt: 1 },
    { 
      partialFilterExpression: { status: 'successful' },
      name: 'successful_transactions_processed_at'
    }
  );
  
  // Text index for searching descriptions
  schema.index({ description: 'text' });
};