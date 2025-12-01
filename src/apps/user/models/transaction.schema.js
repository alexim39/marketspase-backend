import mongoose from 'mongoose';

const bankDetailsSchema = new mongoose.Schema({
  bank: { type: String, trim: true },
  bankCode: { type: String, trim: true },
  accountNumber: { type: String, trim: true },
  accountName: { type: String, trim: true }
});

export const transactionSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
  },
  amount: { type: Number, required: true },
  amountPayable: { type: Number, default: 0 }, // Net amount after fees (for withdrawals)

  type: { 
    type: String, 
    enum: ['credit', 'debit', 'system_correction'], 
    required: true 
  }, // credit = money in, debit = money out

  category: { 
    type: String, 
    enum: [
      'deposit',       // funding wallet
      'withdrawal',    // payout to bank/mobile money
      'campaign',      // marketer spend
      'promotion',     // promoter earning
      'bonus',         // referral/loyalty bonus
      'fee',           // platform/admin fees
      'refund',         // marketer refund
      'transfer',
      'commission',
      'reserved_credit',
      'credit',
      'completed',
      'store_verification',  // Paid store verification
      'store_sale',          // Product sales revenue
      'store_promotion',      // Store-specific campaigns
      'reversal',
      'system_correction',
      'promoter_balance_reset',
      'balance_recalculation',
      'negative_reserved_fix',
      'balance_reset'
    ],
    required: true
  },

  description: { type: String, trim: true },

  // Context references (only used if relevant)
  relatedCampaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  relatedPromotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' },

  bankDetails: { type: bankDetailsSchema, default: null },

  // Transaction state tracking
  status: { 
    type: String, 
    //enum: ['pending','reserved','escrowed','paid','refunded','reversed','failed'],
    enum: [
      'pending', 
      'successful', 
      'failed', 
      'reserved', 
      'processing', 
      'reversed', 
      'cancelled', 
      'completed', 
      'approved', 
      'declined',
      'rejected',
      'paid',
      'reserved_to_promoter'
      
    ], 
    default: 'pending' 
  },

  createdAt: { type: Date, default: Date.now }
});

transactionSchema.pre('validate', function (next) {
  if (!mongoose.isValidObjectId(this._id)) {
    this._id = new mongoose.Types.ObjectId();
  }
  next();
});


// Optional: Create and export the transaction model as well
//export const TransactionModel = mongoose.model('Transaction', transactionSchema);