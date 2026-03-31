import mongoose from "mongoose";
import {
  FEED_POST_TYPE_ARRAY,
  FEED_POST_STATUS_ARRAY,
  CAMPAIGN_STATUS_ARRAY,
  MEDIA_TYPE_ARRAY,
  SHARE_PLATFORM_ARRAY,
  BADGE_TYPE_ARRAY,
  LOCATION_TYPE,
  DEFAULTS,
  VALIDATION
} from "./feed.constants.js";

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
    maxlength: VALIDATION.CONTENT.MAX_LENGTH
  },
  
  type: {
    type: String,
    enum: FEED_POST_TYPE_ARRAY,
    default: DEFAULTS.TYPE,
    index: true
  },
  
  // For earnings type
  earnings: {
    amount: { type: Number, min: 0, default: DEFAULTS.EARNINGS_AMOUNT },
    currency: { type: String, default: DEFAULTS.CURRENCY },
    milestone: { type: String },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }
  },
  
  // For campaign type
  campaign: {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    name: { type: String },
    budget: { type: Number, min: 0 },
    status: { type: String, enum: CAMPAIGN_STATUS_ARRAY }
  },
  
  // For tip type
  tip: {
    title: { type: String },
    category: { type: String },
    views: { type: Number, default: DEFAULTS.TIP_VIEWS }
  },
  
  // Media attachments
  media: [{
    url: { type: String, required: true },
    type: { type: String, enum: MEDIA_TYPE_ARRAY, required: true },
    thumbnail: { type: String }
  }],
  
  // Engagement metrics
  likes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: VALIDATION.COMMENT.MAX_LENGTH },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    replies: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      content: { type: String, required: true, maxlength: VALIDATION.REPLY.MAX_LENGTH },
      likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  
  // Saved/bookmarked by users
  savedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    savedAt: { type: Date, default: Date.now }
  }],
  
  // Shares tracking
  shares: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: SHARE_PLATFORM_ARRAY, required: true },
    sharedAt: { type: Date, default: Date.now }
  }],
  
  // Reach metrics
  reach: {
    impressions: { type: Number, default: DEFAULTS.REACH_IMPRESSIONS },
    uniqueViews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastImpressionAt: { type: Date }
  },
  
  // Badge/Achievement
  badge: {
    type: String,
    enum: BADGE_TYPE_ARRAY,
    default: null
  },
  
  // Post status
  status: {
    type: String,
    enum: FEED_POST_STATUS_ARRAY,
    default: DEFAULTS.STATUS,
    index: true
  },
  
  // Moderation
  moderation: {
    isFlagged: { type: Boolean, default: DEFAULTS.MODERATION_FLAGGED },
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
  trendingScore: { type: Number, default: DEFAULTS.TRENDING_SCORE, index: -1 },
  
  // Location (optional)
  location: {
    type: { type: String, enum: [LOCATION_TYPE.POINT], default: LOCATION_TYPE.POINT },
    coordinates: { type: [Number], index: '2dsphere' }, // [longitude, latitude]
    placeName: { type: String },
    country: { type: String }
  },
  
  // Featured post (admin only)
  isFeatured: { type: Boolean, default: DEFAULTS.IS_FEATURED, index: true },
  featuredUntil: { type: Date },
  featuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

export default feedPostSchema;