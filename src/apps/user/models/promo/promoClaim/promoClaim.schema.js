import mongoose from "mongoose";

const promoClaimSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  promoId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Promo', 
    required: true 
  },
  claimedAt: { 
    type: Date, 
    default: Date.now 
  },
  creditAmount: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['claimed', 'credited', 'expired', 'cancelled'], 
    default: 'claimed' 
  },
  creditedAt: { 
    type: Date 
  },
  transactionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Transaction' 
  }
}, { timestamps: true });

export default promoClaimSchema;