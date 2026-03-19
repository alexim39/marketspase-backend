// Transaction categories
export const TRANSACTION_CATEGORIES = [
  'deposit',         // wallet funding (charge.success)
  'withdrawal',      // payout to bank
  'campaign',        // marketer spend
  'promotion',       // promoter earning
  'bonus',
  'fee',
  'refund',
  'transfer',
  'commission',
  'reserved_credit',
  'credit',
  'completed',
  'store_verification',
  'store_sale',
  'store_promotion',
  'reversal',
  'birthday_bonus',
  'balance_recalculation',
  'promoter_balance_reset',
  'negative_reserved_fix'
];

// Transaction statuses
export const TRANSACTION_STATUSES = [
  'initiated',
  'pending',
  'processing',
  'successful',
  'failed',
  'refunded',
  'reversed',
  'cancelled',
  'abandoned',
  'reserved',
  'approved',
  'declined',
  'completed',
  'paid',
  'reserved_to_promoter', // to be removed. not used anymore
  'rejected'
];

// Transaction types
export const TRANSACTION_TYPES = [
  'credit',
  'debit',
  'system_correction'
];

// Gateway providers
export const GATEWAY_PROVIDERS = {
  PAYSTACK: 'paystack',
  FLUTTERWAVE: 'flutterwave',
  STRIPE: 'stripe',
  BANK_TRANSFER: 'bank_transfer',
  SYSTEM: 'system'
};

// Default values
export const DEFAULTS = {
  GATEWAY: GATEWAY_PROVIDERS.PAYSTACK,
  CURRENCY: 'NGN',
  FEE: 0,
  AMOUNT_PAYABLE: 0,
  STATUS: 'pending'
};