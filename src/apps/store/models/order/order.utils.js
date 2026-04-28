import { VALIDATION } from "./order.constants.js";

/**
 * Generate unique order number
 * @returns {string} - Order number
 */
export const generateOrderNumber = () => {
  const prefix = VALIDATION.ORDER_NUMBER.PREFIX;
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}-${random}`;
};

/**
 * Calculate order totals
 * @param {Array} items - Order items
 * @param {Object} options - Additional options (shippingFee, tax, discount)
 * @returns {Object} - Calculated totals
 */
export const calculateOrderTotals = (items, options = {}) => {
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const shippingFee = options.shippingFee || 0;
  const tax = options.tax || 0;
  const discount = options.discount || 0;
  
  const totalAmount = subtotal + shippingFee + tax - discount;
  
  return {
    subtotal,
    shippingFee,
    tax,
    discount,
    totalAmount: Math.max(0, totalAmount)
  };
};

/**
 * Validate order items
 * @param {Array} items - Order items
 * @returns {Object} - Validation result
 */
export const validateOrderItems = (items) => {
  const errors = [];
  
  if (!items || items.length === 0) {
    errors.push('At least one item is required');
    return { isValid: false, errors };
  }
  
  items.forEach((item, index) => {
    if (!item.product) {
      errors.push(`Item ${index + 1}: Product is required`);
    }
    if (!item.quantity || item.quantity < VALIDATION.MIN_QUANTITY) {
      errors.push(`Item ${index + 1}: Quantity must be at least ${VALIDATION.MIN_QUANTITY}`);
    }
    if (item.quantity > VALIDATION.MAX_QUANTITY) {
      errors.push(`Item ${index + 1}: Quantity cannot exceed ${VALIDATION.MAX_QUANTITY}`);
    }
    if (!item.unitPrice || item.unitPrice < 0) {
      errors.push(`Item ${index + 1}: Valid price is required`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Format order for API response
 * @param {Object} order - Order document
 * @returns {Object} - Formatted order
 */
export const formatOrderResponse = (order) => {
  const orderObj = order.toObject ? order.toObject() : order;
  
  return {
    id: orderObj._id,
    orderNumber: orderObj.orderNumber,
    store: orderObj.store,
    customer: orderObj.customer,
    items: orderObj.items.map(item => ({
      productId: item.product,
      variantName: item.variantName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      commissionEarned: item.commissionEarned,
      promoterId: item.promoterId
    })),
    financials: {
      subtotal: orderObj.subtotal,
      shippingFee: orderObj.shippingFee,
      tax: orderObj.tax,
      discount: orderObj.discount,
      totalAmount: orderObj.totalAmount,
      currency: orderObj.currency
    },
    shippingAddress: orderObj.shippingAddress,
    tracking: {
      number: orderObj.trackingNumber,
      url: orderObj.trackingUrl,
      carrier: orderObj.carrier
    },
    payment: {
      status: orderObj.paymentStatus,
      method: orderObj.paymentMethod,
      reference: orderObj.paymentReference,
      paidAt: orderObj.paidAt
    },
    status: {
      order: orderObj.orderStatus,
      canBeCancelled: orderObj.canBeCancelled,
      canBeRefunded: orderObj.canBeRefunded
    },
    commission: {
      total: orderObj.totalPromoterCommission,
      paid: orderObj.commissionPaid,
      paidAt: orderObj.commissionPaidAt
    },
    timestamps: {
      placedAt: orderObj.placedAt,
      processedAt: orderObj.processedAt,
      shippedAt: orderObj.shippedAt,
      deliveredAt: orderObj.deliveredAt,
      cancelledAt: orderObj.cancelledAt
    },
    notes: {
      customer: orderObj.customerNote,
      admin: orderObj.adminNote
    },
    createdAt: orderObj.createdAt,
    updatedAt: orderObj.updatedAt
  };
};

/**
 * Get status badge color
 * @param {string} status - Order status
 * @returns {string} - Badge color
 */
export const getStatusBadgeColor = (status) => {
  const colors = {
    pending: 'warning',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'danger',
    refunded: 'secondary'
  };
  return colors[status] || 'light';
};

/**
 * Check if status transition is allowed
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Desired status
 * @returns {boolean} - Whether transition is allowed
 */
export const isStatusTransitionAllowed = (fromStatus, toStatus) => {
  const allowed = {
    pending: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: ['refunded'],
    cancelled: [],
    refunded: []
  };
  return allowed[fromStatus]?.includes(toStatus) || false;
};