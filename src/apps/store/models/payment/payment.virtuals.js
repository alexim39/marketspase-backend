export const setupPaymentVirtuals = (schema) => {
  // Virtual for is successful
  schema.virtual('isSuccessful').get(function() {
    return this.status === 'success';
  });

  // Virtual for is failed
  schema.virtual('isFailed').get(function() {
    return this.status === 'failed';
  });

  // Virtual for is pending
  schema.virtual('isPending').get(function() {
    return this.status === 'pending';
  });

  // Virtual for is refunded
  schema.virtual('isRefunded').get(function() {
    return this.status === 'refunded';
  });

  // Virtual for can be refunded
  schema.virtual('canBeRefunded').get(function() {
    return this.status === 'success' && this.refundedAmount < this.amount;
  });

  // Virtual for remaining refundable amount
  schema.virtual('refundableAmount').get(function() {
    return this.amount - this.refundedAmount;
  });

  // Virtual for formatted amount
  schema.virtual('formattedAmount').get(function() {
    return `${this.currency} ${this.amount.toLocaleString()}`;
  });

  // Virtual for processing time (if completed)
  schema.virtual('processingTimeSeconds').get(function() {
    if (!this.completedAt || !this.initiatedAt) return null;
    return Math.floor((this.completedAt - this.initiatedAt) / 1000);
  });

  // Virtual for has payment details
  schema.virtual('hasPaymentDetails').get(function() {
    return !!(this.paymentDetails?.cardLast4 || this.paymentDetails?.bank);
  });

  // Virtual for is fully refunded
  schema.virtual('isFullyRefunded').get(function() {
    return this.status === 'refunded' || this.refundedAmount >= this.amount;
  });
};