export const setupPromoClaimMethods = (schema) => {
  schema.methods.markAsCredited = async function(transactionId) {
    this.status = 'credited';
    this.creditedAt = new Date();
    this.transactionId = transactionId;
    return this.save();
  };

  schema.methods.cancel = async function(reason) {
    this.status = 'cancelled';
    this.metadata = { ...this.metadata, cancellationReason: reason };
    return this.save();
  };

  schema.methods.isExpired = function() {
    // Add custom expiration logic if needed
    return this.status === 'expired';
  };
};