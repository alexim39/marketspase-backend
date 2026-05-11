import mongoose from "mongoose";
import {
  PAYMENT_STATUS_ARRAY,
  PAYMENT_GATEWAY_ARRAY,
  PAYMENT_CHANNEL_ARRAY,
  DEFAULTS,
  ERROR_MESSAGES
} from "./payment.constants.js";

const paymentSchema = new mongoose.Schema({
  // References
  order: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Order", 
    required: true, 
    index: true 
  },
  store: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true, 
    index: true 
  },
  customer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    index: true 
  },
  
  // Payment details
  amount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  currency: { 
    type: String, 
    default: DEFAULTS.CURRENCY 
  },
  
  // Transaction identifiers
  transactionReference: { 
    type: String, 
    unique: true, 
    required: true,
    index: true
  },
  paymentGateway: { 
    type: String, 
    enum: PAYMENT_GATEWAY_ARRAY, 
    required: true 
  },
  gatewayReference: { 
    type: String, 
    index: true 
  },
  
  // Status
  status: { 
    type: String, 
    enum: PAYMENT_STATUS_ARRAY, 
    default: DEFAULTS.STATUS,
    index: true
  },
  
  // For refunds
  refundedAmount: { 
    type: Number, 
    default: DEFAULTS.REFUNDED_AMOUNT,
    min: 0
  },
  refundReference: { 
    type: String,
    index: true
  },
  refundedAt: { 
    type: Date 
  },
  refundReason: { 
    type: String, 
    trim: true 
  },
  
  // Metadata
  paymentDetails: {
    cardLast4: { type: String },
    cardType: { type: String },
    bank: { type: String },
    accountName: { type: String },
    authorizationCode: { type: String }
  },
  
  // Webhook tracking
  webhookReceived: { 
    type: Boolean, 
    default: DEFAULTS.WEBHOOK_RECEIVED 
  },
  webhookPayload: { 
    type: mongoose.Schema.Types.Mixed 
  },
  webhookProcessedAt: { 
    type: Date 
  },
  
  // Channel
  paymentChannel: { 
    type: String, 
    enum: PAYMENT_CHANNEL_ARRAY, 
    default: PAYMENT_CHANNEL_ARRAY[0] // 'web'
  },
  
  // Timestamps
  initiatedAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  completedAt: { 
    type: Date 
  },
  
  // Failed attempts
  failureReason: { 
    type: String, 
    trim: true 
  },
  retryCount: { 
    type: Number, 
    default: DEFAULTS.RETRY_COUNT,
    min: 0
  },
  
  // Customer information at time of payment
  customerEmail: { 
    type: String, 
    trim: true, 
    lowercase: true 
  },
  customerPhone: { 
    type: String, 
    trim: true 
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export default paymentSchema;
