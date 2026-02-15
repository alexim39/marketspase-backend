import mongoose from 'mongoose';

const feedCommentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedPost',
    required: true,
    index: true
  },
  
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedComment',
    default: null,
    index: true
  },
  
  likes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    likedAt: { type: Date, default: Date.now }
  }],
  
  mentions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String }
  }],
  
  media: [{
    url: { type: String },
    type: { type: String, enum: ['image', 'link'] }
  }],
  
  status: {
    type: String,
    enum: ['active', 'deleted', 'reported'],
    default: 'active'
  },
  
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
feedCommentSchema.index({ post: 1, createdAt: -1 });
feedCommentSchema.index({ author: 1, createdAt: -1 });
feedCommentSchema.index({ parentComment: 1 });

// Virtual for reply count
feedCommentSchema.virtual('replyCount').get(function() {
  return this.replies ? this.replies.length : 0;
});

// Virtual for like count
feedCommentSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Method to check if liked by user
feedCommentSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

feedCommentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const FeedCommentModel = mongoose.model('FeedComment', feedCommentSchema);