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
  },
  trackingCode: {
    type: String,
    trim: true
  },
  trackingRef: {
    type: String,
    trim: true
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

const guestCustomerSchema = new mongoose.Schema({
  fullName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  marketingOptIn: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    trim: true,
    default: 'storefront_checkout'
  },
  firstTouchTrackingCode: {
    type: String,
    trim: true
  },
  firstTouchRef: {
    type: String,
    trim: true
  }
}, { _id: false });

const referralInfoSchema = new mongoose.Schema({
  code: {
    type: String,
    trim: true,
    lowercase: true,
  },
  referralId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BuyerReferral",
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  redeemedAt: {
    type: Date,
  },
}, { _id: false });

const releaseRequestSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['none', 'requested', 'approved', 'rejected'],
    default: 'none',
    index: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  requestedByRole: {
    type: String,
    enum: ['marketer', 'promoter', 'customer']
  },
  requestedAt: Date,
  deliveryStatus: {
    type: String,
    enum: ['processing', 'shipped', 'delivered', 'received'],
    default: 'delivered'
  },
  buyerReceived: {
    type: Boolean,
    default: false
  },
  note: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  reviewedAt: Date,
  reviewNote: {
    type: String,
    trim: true,
    maxlength: 1000
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
    index: true 
  },
  customerType: {
    type: String,
    enum: ['registered', 'guest'],
    default: 'registered',
    index: true
  },
  guestCustomer: guestCustomerSchema,
  marketer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
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
  checkoutCurrency: {
    type: String,
    default: DEFAULTS.CURRENCY
  },
  checkoutTotalAmount: {
    type: Number,
    default: null,
    min: 0,
  },
  checkoutExchangeRate: {
    type: Number,
    default: null,
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

  // Storefront escrow lifecycle
  marketerReservedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  promoterReservedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  escrowStatus: {
    type: String,
    enum: ['pending', 'held', 'released', 'refunded'],
    default: 'pending',
    index: true
  },
  escrowHeldAt: {
    type: Date
  },
  escrowReleasedAt: {
    type: Date
  },
  deliveredConfirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  deliveryConfirmedByRole: {
    type: String,
    enum: ['marketer', 'promoter', 'customer', 'admin']
  },
  deliveredConfirmedAt: {
    type: Date
  },
  releaseRequest: {
    type: releaseRequestSchema,
    default: () => ({ status: 'none' })
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

  // Buyer referral
  referral: {
    type: referralInfoSchema,
    default: undefined,
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
