import crypto from 'crypto';

/**
 * Generate transaction reference
 * @returns {string} - Unique transaction reference
 */
export const generateTransactionReference = () => {
  const prefix = 'TXN';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Validate payment amount
 * @param {number} amount - Payment amount
 * @returns {Object} - Validation result
 */
export const validatePaymentAmount = (amount) => {
  if (!amount || amount <= 0) {
    return { isValid: false, error: 'Invalid payment amount' };
  }
  
  if (amount < 50) {
    return { isValid: false, error: 'Minimum payment amount is 50' };
  }
  
  if (amount > 10000000) {
    return { isValid: false, error: 'Maximum payment amount is 10,000,000' };
  }
  
  return { isValid: true, amount };
};

/**
 * Format payment for API response
 * @param {Object} payment - Payment document
 * @returns {Object} - Formatted payment
 */
export const formatPaymentResponse = (payment) => {
  const paymentObj = payment.toObject ? payment.toObject() : payment;
  
  return {
    id: paymentObj._id,
    transactionReference: paymentObj.transactionReference,
    order: paymentObj.order,
    store: paymentObj.store,
    customer: paymentObj.customer,
    amount: paymentObj.amount,
    currency: paymentObj.currency,
    formattedAmount: paymentObj.formattedAmount,
    status: paymentObj.status,
    paymentGateway: paymentObj.paymentGateway,
    gatewayReference: paymentObj.gatewayReference,
    paymentMethod: paymentObj.paymentDetails?.cardType || paymentObj.paymentDetails?.bank || 'unknown',
    paymentChannel: paymentObj.paymentChannel,
    refundable: paymentObj.canBeRefunded,
    refundableAmount: paymentObj.refundableAmount,
    refundedAmount: paymentObj.refundedAmount,
    refundReference: paymentObj.refundReference,
    refundReason: paymentObj.refundReason,
    refundedAt: paymentObj.refundedAt,
    timestamps: {
      initiatedAt: paymentObj.initiatedAt,
      completedAt: paymentObj.completedAt,
      refundedAt: paymentObj.refundedAt
    },
    processingTimeSeconds: paymentObj.processingTimeSeconds,
    failureReason: paymentObj.failureReason,
    retryCount: paymentObj.retryCount,
    hasPaymentDetails: paymentObj.hasPaymentDetails,
    createdAt: paymentObj.createdAt,
    updatedAt: paymentObj.updatedAt
  };
};

/**
 * Generate webhook signature
 * @param {string} payload - Webhook payload
 * @param {string} secret - Webhook secret
 * @returns {string} - Generated signature
 */
export const generateWebhookSignature = (payload, secret) => {
  return crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
};

/**
 * Verify webhook signature
 * @param {string} signature - Received signature
 * @param {string} payload - Webhook payload
 * @param {string} secret - Webhook secret
 * @returns {boolean} - Whether signature is valid
 */
export const verifyWebhookSignature = (signature, payload, secret) => {
  const expectedSignature = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * Get status badge color
 * @param {string} status - Payment status
 * @returns {string} - Badge color
 */
export const getPaymentStatusColor = (status) => {
  const colors = {
    pending: 'warning',
    success: 'success',
    failed: 'danger',
    refunded: 'secondary'
  };
  return colors[status] || 'light';
};