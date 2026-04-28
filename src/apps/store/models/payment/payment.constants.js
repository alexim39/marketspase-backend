// Payment Statuses
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

export const PAYMENT_STATUS_ARRAY = Object.values(PAYMENT_STATUS);

// Payment Gateways
export const PAYMENT_GATEWAY = {
  PAYSTACK: 'paystack',
  FLUTTERWAVE: 'flutterwave',
  STRIPE: 'stripe',
  MANUAL: 'manual'
};

export const PAYMENT_GATEWAY_ARRAY = Object.values(PAYMENT_GATEWAY);

// Payment Channels
export const PAYMENT_CHANNEL = {
  WEB: 'web',
  MOBILE: 'mobile',
  WHATSAPP: 'whatsapp',
  API: 'api'
};

export const PAYMENT_CHANNEL_ARRAY = Object.values(PAYMENT_CHANNEL);

// Default Values
export const DEFAULTS = {
  CURRENCY: 'NGN',
  STATUS: PAYMENT_STATUS.PENDING,
  REFUNDED_AMOUNT: 0,
  RETRY_COUNT: 0,
  WEBHOOK_RECEIVED: false
};

// Webhook Events
export const WEBHOOK_EVENTS = {
  CHARGE_SUCCESS: 'charge.success',
  CHARGE_FAILED: 'charge.failed',
  REFUND_SUCCESS: 'refund.success',
  TRANSFER_SUCCESS: 'transfer.success'
};

// Error Messages
export const ERROR_MESSAGES = {
  PAYMENT_NOT_FOUND: 'Payment record not found',
  INVALID_AMOUNT: 'Invalid payment amount',
  TRANSACTION_REFERENCE_EXISTS: 'Transaction reference already exists',
  PAYMENT_ALREADY_SUCCESSFUL: 'Payment has already been processed successfully',
  PAYMENT_FAILED: 'Payment processing failed',
  REFUND_FAILED: 'Refund processing failed',
  INSUFFICIENT_FUNDS: 'Insufficient funds for refund',
  GATEWAY_ERROR: 'Payment gateway error'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  PAYMENT_INITIATED: 'Payment initiated successfully',
  PAYMENT_SUCCESS: 'Payment completed successfully',
  REFUND_SUCCESS: 'Refund processed successfully',
  WEBHOOK_PROCESSED: 'Webhook processed successfully'
};