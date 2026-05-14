import mongoose from "mongoose";

export const setupPaymentMiddleware = (schema) => {
  // Pre-save middleware
  schema.pre('save', function(next) {
    // Generate transaction reference for new payments
    if (this.isNew && !this.transactionReference) {
      this.transactionReference = this.constructor.generateTransactionReference();
    }
    
    // Ensure amount is positive
    if (this.amount < 0) {
      return next(new Error('Payment amount cannot be negative'));
    }
    
    // Validate refund amount doesn't exceed original
    if (this.refundedAmount > this.amount) {
      return next(new Error('Refund amount cannot exceed payment amount'));
    }
    
    next();
  });
  
  // Pre-update middleware
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    
    // Prevent updating certain fields
    const forbiddenFields = ['transactionReference', 'order', 'store', 'customer', 'amount'];
    forbiddenFields.forEach(field => {
      if (update[field]) {
        delete update[field];
      }
    });
    
    next();
  });
  
  // Post-save middleware
  schema.post('save', async function(doc) {
    // Could emit events for real-time notifications
    // emit('payment.processed', doc);
  });
  
  // Post-find middleware to populate
  schema.post(/^find/, async function(result) {
    if (!result) return;
    
    const populateFields = async (item) => {
      if (item && typeof item.populate === 'function') {
        await item.populate([
          { path: 'order', select: 'orderNumber totalAmount items orderStatus' },
          { path: 'store', select: 'name logo storeLink' },
          { path: 'customer', select: 'username displayName email avatar' }
        ]);
      }
    };
    
    if (Array.isArray(result)) {
      await Promise.all(result.map(item => populateFields(item)));
    } else {
      await populateFields(result);
    }
  });
};