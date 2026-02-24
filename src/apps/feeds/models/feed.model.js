import mongoose from 'mongoose';

// Feed post schema
const feedPostSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  
  type: {
    type: String,
    enum: ['earnings', 'campaign', 'question', 'tip', 'achievement', 'milestone'],
    default: 'question',
    index: true
  },
  
  // For earnings type
  earnings: {
    amount: { type: Number, min: 0 },
    currency: { type: String, default: 'NGN' },
    milestone: { type: String }, // e.g., "First payout", "₦100k milestone"
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }
  },
  
  // For campaign type
  campaign: {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    name: { type: String },
    budget: { type: Number, min: 0 },
    status: { type: String, enum: ["active", "paused", "rejected", "completed", "exhausted", "expired", "pending", "draft", "archived"] }
  },
  
  // For tip type
  tip: {
    title: { type: String },
    category: { type: String },
    views: { type: Number, default: 0 }
  },
  
  // Media attachments
  media: [{
    url: { type: String },
    type: { type: String, enum: ['image', 'video', 'link'] },
    thumbnail: { type: String }
  }],
  
  // Engagement metrics
  likes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, required: true, maxlength: 1000 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    replies: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      content: { type: String, required: true, maxlength: 500 },
      likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  
  // Saved/bookmarked by users
  savedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    savedAt: { type: Date, default: Date.now }
  }],
  
  // Shares tracking
  shares: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    platform: { type: String, enum: ['twitter', 'linkedin', 'facebook', 'copy', 'other'] },
    sharedAt: { type: Date, default: Date.now }
  }],
  
  // Reach metrics
  reach: {
    impressions: { type: Number, default: 0 },
    uniqueViews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastImpressionAt: { type: Date }
  },
  
  // Badge/Achievement
  badge: {
    type: String,
    enum: ['top-promoter', 'verified', 'rising-star', 'expert', 'veteran', null],
    default: null
  },
  
  // Post status
  status: {
    type: String,
    enum: ['published', 'draft', 'archived', 'reported'],
    default: 'published',
    index: true
  },
  
  // Moderation
  moderation: {
    isFlagged: { type: Boolean, default: false },
    flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    flagReason: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String }
  },
  
  // Hashtags
  hashtags: [{
    tag: { type: String, lowercase: true, trim: true },
    count: { type: Number, default: 0 }
  }],
  
  // Mentions
  mentions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String }
  }],
  
  // Trending score (calculated periodically)
  trendingScore: { type: Number, default: 0, index: -1 },
  
  // Location (optional)
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' }, // [longitude, latitude]
    placeName: { type: String },
    country: { type: String }
  },
  
  // Featured post (admin only)
  isFeatured: { type: Boolean, default: false, index: true },
  featuredUntil: { type: Date },
  featuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance
feedPostSchema.index({ 'likes.user': 1 });
feedPostSchema.index({ 'comments.user': 1 });
feedPostSchema.index({ 'savedBy.user': 1 });
feedPostSchema.index({ hashtags: 1 });
feedPostSchema.index({ createdAt: -1, trendingScore: -1 });
feedPostSchema.index({ author: 1, createdAt: -1 });
feedPostSchema.index({ type: 1, createdAt: -1 });

// Virtual for like count
feedPostSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for comment count
feedPostSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

// Virtual for save count
feedPostSchema.virtual('saveCount').get(function() {
  return this.savedBy.length;
});

// Virtual for share count
feedPostSchema.virtual('shareCount').get(function() {
  return this.shares.length;
});

// Method to check if user liked post
feedPostSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Method to check if user saved post
feedPostSchema.methods.isSavedBy = function(userId) {
  return this.savedBy.some(saved => saved.user.toString() === userId.toString());
};

// Method to add impression
feedPostSchema.methods.addImpression = async function(userId) {
  this.reach.impressions += 1;
  if (userId && !this.reach.uniqueViews.includes(userId)) {
    this.reach.uniqueViews.push(userId);
  }
  this.reach.lastImpressionAt = new Date();
  return this.save();
};

// Pre-save middleware
feedPostSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Update hashtags count
  if (this.isModified('hashtags')) {
    const hashtagRegex = /#(\w+)/g;
    const matches = this.content.match(hashtagRegex);
    if (matches) {
      this.hashtags = matches.map(tag => ({
        tag: tag.substring(1).toLowerCase()
      }));
    }
  }
  
  // Extract mentions
  if (this.isModified('content')) {
    const mentionRegex = /@(\w+)/g;
    const matches = this.content.match(mentionRegex);
    if (matches) {
      this.mentions = matches.map(mention => ({
        username: mention.substring(1)
      }));
    }
  }
  
  next();
});

// Calculate trending score (run as a cron job)
feedPostSchema.statics.calculateTrendingScores = async function() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  const posts = await this.find({
    createdAt: { $gte: threeDaysAgo },
    status: 'published'
  });
  
  for (const post of posts) {
    const hoursAgo = (now - post.createdAt) / (1000 * 60 * 60);
    const likeWeight = post.likes.length * 3;
    const commentWeight = post.comments.length * 5;
    const shareWeight = post.shares.length * 4;
    const saveWeight = post.savedBy.length * 2;
    const impressionWeight = Math.log(post.reach.impressions + 1) * 0.5;
    
    // Decay factor - newer posts get higher score
    const decayFactor = Math.exp(-hoursAgo / 24);
    
    post.trendingScore = (likeWeight + commentWeight + shareWeight + saveWeight + impressionWeight) * decayFactor;
    await post.save();
  }
};

export const FeedPostModel = mongoose.model('FeedPost', feedPostSchema);