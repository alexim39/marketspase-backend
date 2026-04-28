import mongoose from "mongoose";
import { 
  ORDER_STATUS, 
  PAYMENT_STATUS,
  ALLOWED_STATUS_TRANSITIONS,
  ERROR_MESSAGES 
} from "./order.constants.js";

export const setupOrderMethods = (schema) => {
  // Update order status with validation
  schema.methods.updateStatus = async function(newStatus, userId = null, reason = null) {
    const oldStatus = this.orderStatus;
    
    // Validate status transition
    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[oldStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Cannot transition from ${oldStatus} to ${newStatus}`);
    }
    
    this.orderStatus = newStatus;
    
    // Set timestamps based on status
    switch(newStatus) {
      case ORDER_STATUS.PROCESSING:
        this.processedAt = new Date();
        break;
      case ORDER_STATUS.SHIPPED:
        this.shippedAt = new Date();
        break;
      case ORDER_STATUS.DELIVERED:
        this.deliveredAt = new Date();
        break;
      case ORDER_STATUS.CANCELLED:
        this.cancelledAt = new Date();
        this.cancelledBy = userId;
        this.cancellationReason = reason;
        break;
    }
    
    await this.save();
    return this;
  };

  // Mark order as paid
  schema.methods.markAsPaid = async function(paymentReference, paymentMethod = null) {
    if (this.paymentStatus === PAYMENT_STATUS.PAID) {
      throw new Error(ERROR_MESSAGES.ORDER_ALREADY_PAID);
    }
    
    this.paymentStatus = PAYMENT_STATUS.PAID;
    this.paymentReference = paymentReference;
    if (paymentMethod) this.paymentMethod = paymentMethod;
    this.paidAt = new Date();
    
    // Automatically update to processing if still pending
    if (this.orderStatus === ORDER_STATUS.PENDING) {
      this.orderStatus = ORDER_STATUS.PROCESSING;
      this.processedAt = new Date();
    }
    
    await this.save();
    
    // Update inventory for each item
    const InventoryHistory = mongoose.model('InventoryHistory');
    for (const item of this.items) {
      const product = await mongoose.model('Product').findById(item.product);
      if (product && product.manageStock) {
        await product.updateQuantity(-item.quantity, 'purchase', {
          orderId: this._id,
          userId: this.customer
        });
      }
      
      // Record inventory history
      await InventoryHistory.create({
        product: item.product,
        variant: item.variantId,
        store: this.store,
        previousQuantity: product?.quantity || 0,
        newQuantity: (product?.quantity || 0) - item.quantity,
        changeAmount: -item.quantity,
        changeType: 'purchase',
        order: this._id,
        user: this.customer
      });
    }
    
    return this;
  };

  // Calculate and assign promoter commission
  schema.methods.calculateCommission = async function(commissionRate) {
    let totalCommission = 0;
    
    for (const item of this.items) {
      if (item.promotionTrackingId) {
        // Get the promotion tracking to get commission rate
        const promotion = await mongoose.model('PromotionTracking').findById(item.promotionTrackingId);
        if (promotion) {
          let commission = 0;
          if (promotion.commissionType === 'percentage') {
            commission = (item.totalPrice * promotion.commissionRate) / 100;
          } else {
            commission = promotion.fixedCommission || 0;
          }
          item.commissionEarned = commission;
          totalCommission += commission;
          
          // Update promotion tracking with conversion
          await promotion.recordConversion(item.totalPrice);
        }
      }
    }
    
    this.totalPromoterCommission = totalCommission;
    await this.save();
    
    return this;
  };

  // Mark commission as paid
  schema.methods.markCommissionPaid = async function() {
    if (this.commissionPaid) {
      throw new Error(ERROR_MESSAGES.COMMISSION_ALREADY_PAID);
    }
    
    this.commissionPaid = true;
    this.commissionPaidAt = new Date();
    await this.save();
    
    return this;
  };

  // Add shipping tracking
  schema.methods.addShippingTracking = async function(trackingNumber, carrier, trackingUrl = null) {
    if (this.orderStatus !== ORDER_STATUS.PROCESSING) {
      throw new Error('Order must be in processing status to add shipping tracking');
    }
    
    this.trackingNumber = trackingNumber;
    this.carrier = carrier;
    if (trackingUrl) this.trackingUrl = trackingUrl;
    this.orderStatus = ORDER_STATUS.SHIPPED;
    this.shippedAt = new Date();
    
    await this.save();
    return this;
  };

  // Cancel order
  schema.methods.cancel = async function(userId, reason = null) {
    if (!this.canBeCancelled) {
      throw new Error(ERROR_MESSAGES.ORDER_CANNOT_BE_CANCELLED);
    }
    
    this.orderStatus = ORDER_STATUS.CANCELLED;
    this.cancelledAt = new Date();
    this.cancelledBy = userId;
    this.cancellationReason = reason;
    
    // If payment was made, mark for refund
    if (this.paymentStatus === PAYMENT_STATUS.PAID) {
      this.paymentStatus = PAYMENT_STATUS.REFUNDED;
    }
    
    await this.save();
    return this;
  };

  // Get order summary
  schema.methods.getSummary = function() {
    return {
      id: this._id,
      orderNumber: this.orderNumber,
      customer: this.customer,
      store: this.store,
      totalAmount: this.totalAmount,
      currency: this.currency,
      orderStatus: this.orderStatus,
      paymentStatus: this.paymentStatus,
      itemCount: this.itemCount,
      placedAt: this.placedAt,
      estimatedDelivery: this.estimatedDelivery
    };
  };

  // Get formatted response
  schema.methods.toResponse = function() {
    const { formatOrderResponse } = require('./order.utils.js');
    return formatOrderResponse(this);
  };
};