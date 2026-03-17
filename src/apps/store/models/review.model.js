import mongoose from "mongoose";

/**
 * Review Model for Product Reviews
 */
const reviewSchema = new mongoose.Schema({
  // References
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Product", 
    required: true,
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true 
  },
  storeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true,
    index: true 
  },
  
  // Review Content
  rating: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5 
  },
  title: { 
    type: String, 
    maxlength: 100 
  },
  comment: { 
    type: String, 
    required: true,
    maxlength: 2000 
  },
  images: [{
    url: String,
    caption: String
  }],
  
  // Verification
  verifiedPurchase: { 
    type: Boolean, 
    default: false 
  },
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Order" 
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId
  },
  variantName: String,
  
  // Engagement
  helpfulCount: { 
    type: Number, 
    default: 0 
  },
  helpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  reportCount: { 
    type: Number, 
    default: 0 
  },
  reportedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reason: String,
    reportedAt: { type: Date, default: Date.now }
  }],
  
  // Response
  response: {
    content: String,
    createdAt: Date,
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    responderName: String
  },
  
  // Status & Moderation
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'pending',
    index: true 
  },
  moderationNotes: String,
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  moderatedAt: Date,
  
  // Metadata
  isFeatured: { 
    type: Boolean, 
    default: false 
  },
  metadata: {
    device: { type: String, enum: ['mobile', 'tablet', 'desktop'] },
    platform: { type: String, enum: ['ios', 'android', 'web'] },
    ipAddress: String,
    userAgent: String
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// =========== INDEXES ===========

reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });
reviewSchema.index({ rating: 1, helpfulCount: -1 });
reviewSchema.index({ verifiedPurchase: 1, createdAt: -1 });

// =========== MIDDLEWARE ===========

reviewSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

reviewSchema.post('save', async function() {
  // Update product average rating
  const Review = mongoose.model('Review');
  const stats = await Review.aggregate([
    { $match: { productId: this.productId, status: 'approved' } },
    { $group: {
      _id: null,
      averageRating: { $avg: '$rating' },
      count: { $sum: 1 }
    }}
  ]);

  await mongoose.model('Product').findByIdAndUpdate(this.productId, {
    averageRating: stats[0]?.averageRating || 0,
    ratingCount: stats[0]?.count || 0
  });
});

// =========== VIRTUAL PROPERTIES ===========

reviewSchema.virtual('isHelpful').get(function() {
  return this.helpfulCount > 0;
});

reviewSchema.virtual('hasResponse').get(function() {
  return !!(this.response && this.response.content);
});

reviewSchema.virtual('hasImages').get(function() {
  return this.images && this.images.length > 0;
});

// =========== INSTANCE METHODS ===========

reviewSchema.methods.markHelpful = async function(userId) {
  if (!this.helpfulBy.includes(userId)) {
    this.helpfulBy.push(userId);
    this.helpfulCount += 1;
    await this.save();
  }
  return this;
};

reviewSchema.methods.unmarkHelpful = async function(userId) {
  const index = this.helpfulBy.indexOf(userId);
  if (index > -1) {
    this.helpfulBy.splice(index, 1);
    this.helpfulCount -= 1;
    await this.save();
  }
  return this;
};

reviewSchema.methods.report = async function(userId, reason) {
  const alreadyReported = this.reportedBy.some(r => r.user.toString() === userId.toString());
  if (!alreadyReported) {
    this.reportedBy.push({ user: userId, reason });
    this.reportCount += 1;
    
    // Auto-flag if too many reports
    if (this.reportCount >= 5) {
      this.status = 'flagged';
    }
    
    await this.save();
  }
  return this;
};

// =========== STATIC METHODS ===========

reviewSchema.statics.getProductStats = async function(productId) {
  const stats = await this.aggregate([
    { $match: { productId: mongoose.Types.ObjectId(productId), status: 'approved' } },
    { $group: {
      _id: null,
      averageRating: { $avg: '$rating' },
      totalReviews: { $sum: 1 },
      verifiedCount: { $sum: { $cond: ['$verifiedPurchase', 1, 0] } },
      withImagesCount: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] }, 1, 0] } }
    }}
  ]);
  
  return stats[0] || {
    averageRating: 0,
    totalReviews: 0,
    verifiedCount: 0,
    withImagesCount: 0
  };
};

reviewSchema.statics.getRatingBreakdown = async function(productId) {
  const breakdown = await this.aggregate([
    { $match: { productId: mongoose.Types.ObjectId(productId), status: 'approved' } },
    { $group: {
      _id: '$rating',
      count: { $sum: 1 }
    }},
    { $sort: { _id: -1 } }
  ]);
  
  const result = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  breakdown.forEach(item => {
    result[item._id] = item.count;
  });
  
  return result;
};

export const ReviewModel = mongoose.model("Review", reviewSchema);