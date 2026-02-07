// transaction.schema.js
import mongoose from 'mongoose';

const bankDetailsSchema = new mongoose.Schema({
  bank: { type: String, trim: true },
  bankCode: { type: String, trim: true },
  accountNumber: { type: String, trim: true },
  accountName: { type: String, trim: true }
}, { _id: false });

export const transactionSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
  },

  // 🔐 Idempotency key from Paystack initialize/verify/webhook
  reference: { type: String, trim: true, index: true }, // cannot be globally unique across embedded arrays; we do app-level idempotency

  // Gateway info
  gateway: { type: String, default: 'paystack' },
  currency: { type: String, default: 'NGN' },
  fee: { type: Number, default: 0 },              // in kobo if amount is kobo
  transferCode: { type: String, trim: true },     // for payouts
  failureReason: { type: String, trim: true },    // for failed payouts
  meta: { type: Object, default: {} },            // raw payload snapshot (sanitized)
  processedAt: { type: Date, default: null },

  // Amounts (store **kobo** if Paystack)
  amount: { type: Number, required: true },
  amountPayable: { type: Number, default: 0 },    // net amount after fees (for withdrawals)

  // Directions & categories
  type: {
    type: String,
    enum: ['credit', 'debit', 'system_correction'],
    required: true
  },
  category: {
    type: String,
    enum: [
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
    ],
    required: true
  },
  description: { type: String, trim: true },

  // Optional context
  relatedCampaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  relatedPromotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' },
  bankDetails: { type: bankDetailsSchema, default: null },

  // Lifecycle status (consolidated)
  status: {
    type: String,
    enum: [
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
      'reserved_to_promoter',
      'rejected'
    ],
    default: 'pending',
    index: true
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// keep _id valid + bump updatedAt
transactionSchema.pre('validate', function (next) {
  if (!mongoose.isValidObjectId(this._id)) {
    this._id = new mongoose.Types.ObjectId();
  }
  next();
});
transactionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});


// Optional: Create and export the transaction model as well
//export const TransactionModel = mongoose.model('Transaction', transactionSchema);