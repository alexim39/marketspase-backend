import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  // Store & Basic Info
  store: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true,
    index: true 
  },
  name: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 3,
    maxlength: 200 
  },
  slug: { 
    type: String, 
    unique: true, 
    lowercase: true,
    index: true 
  },
  description: { 
    type: String, 
    maxlength: 2000 
  },

  currency: { type: String, default: 'NGN' },
  
  // Category & Classification
  category: { 
    type: String, 
    required: true,
    index: true 
  },
  brand: { 
    type: String, 
    trim: true 
  },
  tags: [{ 
    type: String, 
    lowercase: true,
    trim: true 
  }],
  
  // Pricing
  price: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  originalPrice: { 
    type: Number, 
    min: 0,
    default: 0 
  },
  costPrice: { 
    type: Number, 
    min: 0,
    default: 0 
  },
  
  // Inventory Management
  sku: { 
    type: String, 
    unique: true,
    sparse: true,
    trim: true 
  },
  quantity: { 
    type: Number, 
    required: true, 
    default: 0,
    min: 0 
  },
  lowStockAlert: { 
    type: Number, 
    default: 5,
    min: 0 
  },
  manageStock: { 
    type: Boolean, 
    default: true 
  },
  backorderAllowed: { 
    type: Boolean, 
    default: false 
  },
  soldIndividually: { 
    type: Boolean, 
    default: false 
  },
  
  // Tax & Financial
  taxable: { 
    type: Boolean, 
    default: true 
  },
  taxClass: { 
    type: String, 
    enum: ['standard', 'reduced', 'zero', 'exempt'],
    default: 'standard' 
  },
  
  // Images & Media
  images: [{
    url: { type: String, required: true },
    altText: String,
    isMain: { type: Boolean, default: false },
    order: { type: Number, default: 0 }
  }],
  
  // Shipping
  requiresShipping: { 
    type: Boolean, 
    default: true 
  },
  weight: { 
    type: Number,
    min: 0 
  },
  weightUnit: { 
    type: String, 
    enum: ['kg', 'g', 'lb', 'oz'],
    default: 'kg' 
  },
  dimensions: {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    unit: { 
      type: String, 
      enum: ['cm', 'm', 'in', 'ft'],
      default: 'cm' 
    }
  },
  shippingClass: { 
    type: String, 
    enum: ['', 'fragile', 'oversized', 'refrigerated'],
    default: '' 
  },
  
  // Variants System
  hasVariants: { 
    type: Boolean, 
    default: false 
  },
  attributes: [{
    name: { type: String, required: true },
    values: [{ type: String, required: true }],
    visible: { type: Boolean, default: true },
    variation: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  }],
  variants: [{
    name: { type: String, required: true },
    sku: { type: String, unique: true, sparse: true },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    attributes: Map,
    isActive: { type: Boolean, default: true },
    lowStockAlert: { type: Number, default: 5, min: 0 }
  }],
  
  // Digital Products
  isDigital: { 
    type: Boolean, 
    default: false 
  },
  digitalProduct: {
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    downloadLimit: { type: Number, default: 0 },
    downloadExpiry: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 }
  },
  
  // SEO
  seo: {
    title: { type: String, maxlength: 60 },
    description: { type: String, maxlength: 160 },
    keywords: [{ type: String, lowercase: true }],
    slug: { type: String, unique: true, sparse: true }
  },
  
  // Status & Scheduling
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  },
  isFeatured: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  scheduledStart: { 
    type: Date 
  },
  scheduledEnd: { 
    type: Date 
  },
  
  // Sales & Analytics
  viewCount: { 
    type: Number, 
    default: 0 
  },
  purchaseCount: { 
    type: Number, 
    default: 0 
  },
  averageRating: { 
    type: Number, 
    min: 0, 
    max: 5, 
    default: 0 
  },
  ratingCount: { 
    type: Number, 
    default: 0 
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  
  // Metadata
  meta: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  
  // Soft Delete
  isDeleted: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  deletedAt: { 
    type: Date 
  },

  isPublished: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  publishedAt: { 
    type: Date 
  },
  publishedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  promotionStartDate: { 
    type: Date 
  },
  promotionEndDate: { 
    type: Date 
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export default productSchema;