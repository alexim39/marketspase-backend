export const setupTransactionMethods = (schema) => {
  // Mark transaction as successful
  schema.methods.markAsSuccessful = async function(metadata = {}) {
    this.status = 'successful';
    this.processedAt = new Date();
    if (metadata) {
      this.meta = { ...this.meta, ...metadata };
    }
    return this.save();
  };

  // Mark transaction as failed
  schema.methods.markAsFailed = async function(reason, metadata = {}) {
    this.status = 'failed';
    this.failureReason = reason;
    if (metadata) {
      this.meta = { ...this.meta, ...metadata };
    }
    return this.save();
  };

  // Mark transaction as refunded
  schema.methods.markAsRefunded = async function(metadata = {}) {
    this.status = 'refunded';
    if (metadata) {
      this.meta = { ...this.meta, ...metadata };
    }
    return this.save();
  };

  // Check if transaction is successful
  schema.methods.isSuccessful = function() {
    return this.status === 'successful';
  };

  // Check if transaction is pending
  schema.methods.isPending = function() {
    return ['pending', 'processing', 'initiated'].includes(this.status);
  };

  // Check if transaction is failed
  schema.methods.isFailed = function() {
    return ['failed', 'cancelled', 'abandoned', 'rejected', 'declined'].includes(this.status);
  };

  // Get formatted amount (converts from kobo if needed)
  schema.methods.getFormattedAmount = function() {
    if (this.currency === 'NGN' && this.gateway === 'paystack') {
      return this.amount / 100; // Convert from kobo to naira
    }
    return this.amount;
  };

  // Get net amount (after fees)
  schema.methods.getNetAmount = function() {
    return this.amountPayable || (this.amount - (this.fee || 0));
  };
};