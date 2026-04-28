import mongoose from "mongoose";
import {
  ORDER_STATUS_ARRAY,
  PAYMENT_STATUS_ARRAY,
  PAYMENT_METHOD_ARRAY,
  DEFAULTS,
  VALIDATION,
  ERROR_MESSAGES
} from "./order.constants.js";

const orderItemSchema = new mongoose.Schema({
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Product", 
    required: true 
  },
  variantId: { 
    type: mongoose.Schema.Types.ObjectId 
  },
  variantName: { 
    type: String,
    trim: true
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: VALIDATION.MIN_QUANTITY,
    max: VALIDATION.MAX_QUANTITY
  },
  unitPrice: { 
    type: Number, 
    required: true, 
    min: VALIDATION.MIN_AMOUNT 
  },
  totalPrice: { 
    type: Number, 
    required: true, 
    min: VALIDATION.MIN_AMOUNT 
  },
  // Track which promotion drove this sale
  promotionTrackingId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "PromotionTracking" 
  },
  promoterId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  commissionEarned: { 
    type: Number, 
    default: 0,
    min: 0 
  }
}, { _id: true });

const shippingAddressSchema = new mongoose.Schema({
  fullName: { 
    type: String, 
    required: true, 
    trim: true 
  },
  street: { 
    type: String, 
    required: true, 
    trim: true 
  },
  city: { 
    type: String, 
    required: true, 
    trim: true 
  },
  state: { 
    type: String, 
    required: true, 
    trim: true 
  },
  country: { 
    type: String, 
    required: true, 
    trim: true,
    default: 'Nigeria'
  },
  postalCode: { 
    type: String, 
    trim: true 
  },
  phone: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    trim: true, 
    lowercase: true 
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  // Order identifiers
  orderNumber: { 
    type: String, 
    unique: true, 
    required: true,
    index: true
  },
  
  // References
  store: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true, 
    index: true 
  },
  customer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    index: true 
  },
  
  // Order items
  items: [orderItemSchema],
  
  // Financials
  subtotal: { 
    type: Number, 
    required: true, 
    min: VALIDATION.MIN_AMOUNT 
  },
  shippingFee: { 
    type: Number, 
    default: DEFAULTS.SHIPPING_FEE, 
    min: 0 
  },
  tax: { 
    type: Number, 
    default: DEFAULTS.TAX, 
    min: 0 
  },
  discount: { 
    type: Number, 
    default: DEFAULTS.DISCOUNT, 
    min: 0 
  },
  totalAmount: { 
    type: Number, 
    required: true, 
    min: VALIDATION.MIN_AMOUNT 
  },
  currency: { 
    type: String, 
    default: DEFAULTS.CURRENCY 
  },
  
  // Shipping
  shippingAddress: { 
    type: shippingAddressSchema, 
    required: true 
  },
  trackingNumber: { 
    type: String, 
    trim: true 
  },
  trackingUrl: { 
    type: String, 
    trim: true 
  },
  carrier: { 
    type: String, 
    trim: true 
  },
  
  // Payment
  paymentStatus: { 
    type: String, 
    enum: PAYMENT_STATUS_ARRAY, 
    default: DEFAULTS.PAYMENT_STATUS,
    index: true
  },
  paymentMethod: { 
    type: String, 
    enum: PAYMENT_METHOD_ARRAY,
    required: true
  },
  paymentReference: { 
    type: String, 
    unique: true, 
    sparse: true 
  },
  paidAt: { 
    type: Date 
  },
  
  // Order status
  orderStatus: { 
    type: String, 
    enum: ORDER_STATUS_ARRAY, 
    default: DEFAULTS.ORDER_STATUS,
    index: true
  },
  
  // Promoter commission tracking
  totalPromoterCommission: { 
    type: Number, 
    default: DEFAULTS.TOTAL_PROMOTER_COMMISSION,
    min: 0
  },
  commissionPaid: { 
    type: Boolean, 
    default: DEFAULTS.COMMISSION_PAID 
  },
  commissionPaidAt: { 
    type: Date 
  },
  
  // Timestamps
  placedAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  processedAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  cancelledBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  cancellationReason: { 
    type: String, 
    trim: true 
  },
  
  // Customer notes
  customerNote: { 
    type: String, 
    trim: true,
    maxlength: 500
  },
  adminNote: { 
    type: String, 
    trim: true 
  },
  
  // Soft delete
  isDeleted: { 
    type: Boolean, 
    default: DEFAULTS.IS_DELETED,
    index: true
  },
  deletedAt: Date,
  deletedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export default orderSchema;