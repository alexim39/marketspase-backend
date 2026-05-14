import mongoose from "mongoose";
import { PAYMENT_STATUS, ERROR_MESSAGES } from "./payment.constants.js";

export const setupPaymentMethods = (schema) => {
  // Mark payment as success
  schema.methods.markAsSuccess = async function(gatewayReference, paymentDetails = {}) {
    if (this.status === PAYMENT_STATUS.SUCCESS) {
      throw new Error(ERROR_MESSAGES.PAYMENT_ALREADY_SUCCESSFUL);
    }
    
    this.status = PAYMENT_STATUS.SUCCESS;
    this.gatewayReference = gatewayReference;
    this.completedAt = new Date();
    this.paymentDetails = { ...this.paymentDetails, ...paymentDetails };
    
    await this.save();
    
    // Update order payment status
    const Order = mongoose.model('Order');
    const order = await Order.findById(this.order);
    if (order) {
      await order.markAsPaid(this.transactionReference);
    }
    
    return this;
  };

  // Mark payment as failed
  schema.methods.markAsFailed = async function(reason, gatewayReference = null) {
    this.status = PAYMENT_STATUS.FAILED;
    this.failureReason = reason;
    this.completedAt = new Date();
    if (gatewayReference) this.gatewayReference = gatewayReference;
    
    await this.save();
    return this;
  };

  // Process refund
  schema.methods.refund = async function(amount, reason, refundReference = null) {
    if (!this.canBeRefunded) {
      throw new Error(ERROR_MESSAGES.REFUND_FAILED);
    }
    
    if (amount > this.refundableAmount) {
      throw new Error(ERROR_MESSAGES.INSUFFICIENT_FUNDS);
    }
    
    this.refundedAmount += amount;
    this.refundReason = reason;
    if (refundReference) this.refundReference = refundReference;
    this.refundedAt = new Date();
    
    // Update status if fully refunded
    if (this.refundedAmount >= this.amount) {
      this.status = PAYMENT_STATUS.REFUNDED;
    }
    
    await this.save();
    
    // Update order if fully refunded
    if (this.status === PAYMENT_STATUS.REFUNDED) {
      const Order = mongoose.model('Order');
      const order = await Order.findById(this.order);
      if (order) {
        order.paymentStatus = PAYMENT_STATUS.REFUNDED;
        await order.save();
      }
    }
    
    return this;
  };

  // Process webhook
  schema.methods.processWebhook = async function(payload, eventType) {
    this.webhookReceived = true;
    this.webhookPayload = payload;
    this.webhookProcessedAt = new Date();
    
    // Handle different webhook events
    switch(eventType) {
      case 'charge.success':
        await this.markAsSuccess(payload.reference, payload.paymentDetails);
        break;
      case 'charge.failed':
        await this.markAsFailed(payload.failureReason, payload.reference);
        break;
      case 'refund.success':
        // Update refund status if needed
        break;
    }
    
    await this.save();
    return this;
  };

  // Increment retry count
  schema.methods.incrementRetry = async function() {
    this.retryCount += 1;
    await this.save();
    return this;
  };

  // Get payment summary
  schema.methods.getSummary = function() {
    return {
      id: this._id,
      transactionReference: this.transactionReference,
      amount: this.amount,
      currency: this.currency,
      status: this.status,
      paymentGateway: this.paymentGateway,
      initiatedAt: this.initiatedAt,
      completedAt: this.completedAt,
      isSuccessful: this.isSuccessful,
      canBeRefunded: this.canBeRefunded,
      refundableAmount: this.refundableAmount
    };
  };

  // Get formatted response
  schema.methods.toResponse = function() {
    const { formatPaymentResponse } = require('./payment.utils.js');
    return formatPaymentResponse(this);
  };
};