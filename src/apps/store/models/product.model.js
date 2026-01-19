import mongoose from "mongoose";

// 1. Enhanced Product Schema with all frontend fields
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
    downloadLimit: { type: Number, default: 0 }, // 0 = unlimited
    downloadExpiry: { type: Number, default: 0 }, // 0 = never expires
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
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 2. Promotion Tracking Model (Enhanced)
const promotionTrackingSchema = new mongoose.Schema({
  // References
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Product", 
    required: true,
    index: true 
  },
  promoter: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true 
  },
  store: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true,
    index: true 
  },
  
  // Tracking Identifiers
  uniqueCode: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  uniqueId: { 
    type: String, 
    unique: true,
    index: true 
  },
  
  // Commission Settings
  commissionRate: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100 
  },
  commissionType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  fixedCommission: { type: Number, min: 0 },
  
  // Analytics & Performance
  viewCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  clickCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  conversionCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  earnings: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  
  // Status
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  },
  isApproved: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  
  // Settings
  startDate: { 
    type: Date,
    default: Date.now 
  },
  endDate: { 
    type: Date 
  },
  maxConversions: { 
    type: Number,
    min: 0 
  },
  
  // Performance Metrics
  clickThroughRate: { 
    type: Number,
    default: 0,
    min: 0,
    max: 100 
  },
  conversionRate: { 
    type: Number,
    default: 0,
    min: 0,
    max: 100 
  },
  averageOrderValue: { 
    type: Number,
    default: 0,
    min: 0 
  },
  
  // Tracking Data
  deviceTypes: {
    mobile: { type: Number, default: 0 },
    desktop: { type: Number, default: 0 },
    tablet: { type: Number, default: 0 }
  },
  referralSources: [{
    source: String,
    count: { type: Number, default: 0 }
  }],
  
  // Timestamps & Metadata
  lastActivityAt: { 
    type: Date 
  },
  metadata: {
    campaignName: String,
    notes: String,
    customParams: Map
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 3. Product Inventory History (For auditing)
const inventoryHistorySchema = new mongoose.Schema({
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Product", 
    required: true,
    index: true 
  },
  variant: { 
    type: mongoose.Schema.Types.ObjectId 
  },
  store: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true 
  },
  
  // Quantity Changes
  previousQuantity: { type: Number, required: true },
  newQuantity: { type: Number, required: true },
  changeAmount: { type: Number, required: true },
  changeType: {
    type: String,
    enum: ['purchase', 'restock', 'adjustment', 'return', 'damage', 'transfer'],
    required: true
  },
  
  // Reference Information
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  
  // Metadata
  reason: String,
  notes: String,
  ipAddress: String,
  userAgent: String
}, { 
  timestamps: true,
  index: { product: 1, createdAt: -1 }
});

// 4. Product Price History (For price tracking)
const priceHistorySchema = new mongoose.Schema({
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Product", 
    required: true,
    index: true 
  },
  variant: { 
    type: mongoose.Schema.Types.ObjectId 
  },
  store: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true 
  },
  
  // Price Information
  previousPrice: { type: Number, required: true },
  newPrice: { type: Number, required: true },
  changeType: {
    type: String,
    enum: ['manual', 'sale', 'seasonal', 'cost_based', 'competitor'],
    required: true
  },
  
  // Promotion Info
  isPromotional: { type: Boolean, default: false },
  promotionName: String,
  promotionStart: Date,
  promotionEnd: Date,
  
  // Metadata
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reason: String,
  notes: String
}, { 
  timestamps: true,
  index: { product: 1, createdAt: -1 }
});

// =========== INDEXES ===========

// Product Indexes
productSchema.index({ store: 1, isActive: 1, isDeleted: 1 });
productSchema.index({ category: 1, isActive: 1, isDeleted: 1 });
productSchema.index({ tags: 1, isActive: 1 });
productSchema.index({ price: 1, isActive: 1 });
productSchema.index({ isFeatured: 1, isActive: 1, createdAt: -1 });
productSchema.index({ "seo.slug": 1 }, { unique: true, sparse: true });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ "variants.sku": 1 }, { sparse: true });
productSchema.index({ name: "text", description: "text", tags: "text" });

// Promotion Tracking Indexes
promotionTrackingSchema.index({ product: 1, promoter: 1 }, { unique: true });
promotionTrackingSchema.index({ promoter: 1, isActive: 1, isApproved: 1 });
promotionTrackingSchema.index({ store: 1, product: 1, isActive: 1 });
promotionTrackingSchema.index({ uniqueCode: 1 }, { unique: true });
promotionTrackingSchema.index({ uniqueId: 1 }, { unique: true });
promotionTrackingSchema.index({ createdAt: -1 });
promotionTrackingSchema.index({ earnings: -1 });

// =========== MIDDLEWARE ===========

// Product Pre-save middleware for slug generation
productSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  
  // Ensure main image is set
  if (this.images && this.images.length > 0) {
    this.images = this.images.map((img, index) => ({
      ...img,
      isMain: index === 0,
      order: index
    }));
  }
  
  // Auto-generate SKU if not provided
  if (!this.sku && this.name) {
    const baseSku = this.name.substring(0, 20).toUpperCase().replace(/\s+/g, '-');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.sku = `${baseSku}-${random}`;
  }
  
  // Update meta timestamps
  this.meta.updatedAt = new Date();
  
  next();
});

// Promotion Tracking Pre-save middleware
promotionTrackingSchema.pre('save', function(next) {
  // Generate unique code if not provided
  if (!this.uniqueCode) {
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    this.uniqueCode = `PROMO-${random}`;
  }
  
  // Generate unique ID if not provided
  if (!this.uniqueId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.uniqueId = `${this.promoter.toString().substring(0, 4)}-${this.product.toString().substring(0, 4)}-${timestamp}-${random}`;
  }
  
  // Calculate rates
  if (this.viewCount > 0) {
    this.clickThroughRate = (this.clickCount / this.viewCount) * 100;
  }
  if (this.clickCount > 0) {
    this.conversionRate = (this.conversionCount / this.clickCount) * 100;
  }
  
  this.lastActivityAt = new Date();
  
  next();
});

// =========== VIRTUAL PROPERTIES ===========

// Product virtuals
productSchema.virtual('isInStock').get(function() {
  if (!this.manageStock) return true;
  return this.quantity > 0;
});

productSchema.virtual('isLowStock').get(function() {
  if (!this.manageStock) return false;
  return this.quantity > 0 && this.quantity <= this.lowStockAlert;
});

productSchema.virtual('isOutOfStock').get(function() {
  if (!this.manageStock) return false;
  return this.quantity === 0;
});

productSchema.virtual('discountPercentage').get(function() {
  if (!this.originalPrice || this.originalPrice <= this.price) return 0;
  return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
});

productSchema.virtual('mainImage').get(function() {
  const mainImg = this.images?.find(img => img.isMain);
  return mainImg ? mainImg.url : (this.images?.[0]?.url || null);
});

// Promotion Tracking virtuals
promotionTrackingSchema.virtual('totalEarnings').get(function() {
  return this.earnings || 0;
});

promotionTrackingSchema.virtual('isExpired').get(function() {
  if (!this.endDate) return false;
  return new Date() > this.endDate;
});

promotionTrackingSchema.virtual('daysActive').get(function() {
  const start = this.startDate || this.createdAt;
  const diff = new Date() - new Date(start);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// =========== STATIC METHODS ===========

// Product static methods
productSchema.statics.findActive = function(query = {}) {
  return this.find({ ...query, isActive: true, isDeleted: false });
};

productSchema.statics.findByStore = function(storeId, options = {}) {
  const query = { store: storeId, isDeleted: false };
  if (options.activeOnly !== false) {
    query.isActive = true;
  }
  return this.find(query);
};

productSchema.statics.findLowStock = function(storeId) {
  return this.find({
    store: storeId,
    isActive: true,
    isDeleted: false,
    manageStock: true,
    quantity: { $lte: '$lowStockAlert' }
  });
};

// Promotion Tracking static methods
promotionTrackingSchema.statics.findActivePromotions = function(promoterId) {
  return this.find({
    promoter: promoterId,
    isActive: true,
    isApproved: true,
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gt: new Date() } }
    ]
  });
};

promotionTrackingSchema.statics.incrementViews = async function(trackingId, deviceType = 'desktop') {
  const update = { $inc: { viewCount: 1 } };
  
  if (deviceType && ['mobile', 'desktop', 'tablet'].includes(deviceType)) {
    update.$inc[`deviceTypes.${deviceType}`] = 1;
  }
  
  return this.findByIdAndUpdate(trackingId, update, { new: true });
};

promotionTrackingSchema.statics.recordConversion = async function(trackingId, orderValue) {
  const tracking = await this.findById(trackingId);
  if (!tracking) throw new Error('Promotion tracking not found');
  
  let commission = 0;
  if (tracking.commissionType === 'percentage') {
    commission = (orderValue * tracking.commissionRate) / 100;
  } else {
    commission = tracking.fixedCommission || 0;
  }
  
  return this.findByIdAndUpdate(
    trackingId,
    {
      $inc: {
        conversionCount: 1,
        earnings: commission
      },
      $set: {
        lastActivityAt: new Date()
      }
    },
    { new: true }
  );
};

// =========== INSTANCE METHODS ===========

// Product instance methods
productSchema.methods.updateQuantity = async function(change, changeType, options = {}) {
  const previousQuantity = this.quantity;
  const newQuantity = previousQuantity + change;
  
  if (newQuantity < 0) {
    throw new Error('Insufficient stock');
  }
  
  this.quantity = newQuantity;
  await this.save();
  
  // Record inventory history
  const InventoryHistory = mongoose.model('InventoryHistory');
  await InventoryHistory.create({
    product: this._id,
    store: this.store,
    previousQuantity,
    newQuantity,
    changeAmount: change,
    changeType,
    order: options.orderId,
    user: options.userId,
    reason: options.reason,
    notes: options.notes
  });
  
  return this;
};

productSchema.methods.addImage = function(imageData) {
  const newImage = {
    url: imageData.url,
    altText: imageData.altText || `Product image ${this.images.length + 1}`,
    isMain: this.images.length === 0,
    order: this.images.length
  };
  
  this.images.push(newImage);
  return this;
};

productSchema.methods.setMainImage = function(imageIndex) {
  if (imageIndex >= 0 && imageIndex < this.images.length) {
    this.images.forEach((img, index) => {
      img.isMain = index === imageIndex;
    });
  }
  return this;
};

// Promotion Tracking instance methods
promotionTrackingSchema.methods.incrementClicks = async function() {
  this.clickCount += 1;
  this.lastActivityAt = new Date();
  return this.save();
};

promotionTrackingSchema.methods.getStats = function() {
  return {
    views: this.viewCount,
    clicks: this.clickCount,
    conversions: this.conversionCount,
    earnings: this.earnings,
    clickThroughRate: this.clickThroughRate,
    conversionRate: this.conversionRate,
    averageOrderValue: this.averageOrderValue
  };
};

// =========== COMPOUND INDEXES FOR PERFORMANCE ===========

// Additional compound indexes for common query patterns
productSchema.index({ store: 1, category: 1, price: 1, isActive: 1 });
productSchema.index({ store: 1, isFeatured: 1, createdAt: -1 });
productSchema.index({ store: 1, tags: 1, isActive: 1 });

promotionTrackingSchema.index({ store: 1, product: 1, isActive: 1, isApproved: 1 });
promotionTrackingSchema.index({ promoter: 1, createdAt: -1, earnings: -1 });
promotionTrackingSchema.index({ product: 1, conversionCount: -1 });

// =========== EXPORT MODELS ===========

export const ProductModel = mongoose.model("Product", productSchema);
export const PromotionTrackingModel = mongoose.model("PromotionTracking", promotionTrackingSchema);
export const InventoryHistoryModel = mongoose.model("InventoryHistory", inventoryHistorySchema);
export const PriceHistoryModel = mongoose.model("PriceHistory", priceHistorySchema);