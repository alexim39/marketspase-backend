// Order Statuses
export const ORDER_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

export const ORDER_STATUS_ARRAY = Object.values(ORDER_STATUS);

// Payment Statuses
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded'
};

export const PAYMENT_STATUS_ARRAY = Object.values(PAYMENT_STATUS);

// Payment Methods
export const PAYMENT_METHOD = {
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  USSD: 'ussd',
  QR: 'qr',
  WALLET: 'wallet',
  PAYSTACK: 'paystack',
  FLUTTERWAVE: 'flutterwave'
};

export const PAYMENT_METHOD_ARRAY = Object.values(PAYMENT_METHOD);

// Default Values
export const DEFAULTS = {
  SHIPPING_FEE: 0,
  TAX: 0,
  DISCOUNT: 0,
  CURRENCY: 'NGN',
  ORDER_STATUS: ORDER_STATUS.PENDING,
  PAYMENT_STATUS: PAYMENT_STATUS.PENDING,
  TOTAL_PROMOTER_COMMISSION: 0,
  COMMISSION_PAID: false,
  IS_DELETED: false
};

// Validation Rules
export const VALIDATION = {
  ORDER_NUMBER: {
    PATTERN: /^ORD-[A-Z0-9]{8,12}$/,
    PREFIX: 'ORD-'
  },
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 999,
  MIN_AMOUNT: 0
};

// Error Messages
export const ERROR_MESSAGES = {
  ORDER_NOT_FOUND: 'Order not found',
  INVALID_ORDER_STATUS: 'Invalid order status transition',
  INSUFFICIENT_STOCK: 'Insufficient stock for one or more items',
  ORDER_ALREADY_PAID: 'Order has already been paid for',
  ORDER_CANNOT_BE_CANCELLED: 'Order cannot be cancelled in its current state',
  PAYMENT_FAILED: 'Payment processing failed',
  INVALID_PAYMENT_METHOD: 'Invalid payment method',
  DUPLICATE_ORDER_NUMBER: 'Order number already exists',
  COMMISSION_ALREADY_PAID: 'Commission has already been paid for this order'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  ORDER_CREATED: 'Order created successfully',
  ORDER_UPDATED: 'Order updated successfully',
  ORDER_CANCELLED: 'Order cancelled successfully',
  PAYMENT_SUCCESS: 'Payment processed successfully',
  COMMISSION_PAID: 'Promoter commission paid successfully'
};

// Order Status Transition Rules
export const ALLOWED_STATUS_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.REFUNDED]: []
};