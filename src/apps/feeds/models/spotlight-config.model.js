import mongoose from 'mongoose';

const spotlightConfigSchema = new mongoose.Schema({
  // Ordered list of post IDs in the spotlight rotation
  postIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedPost',
    required: true
  }],

  // Rotation interval in minutes (default: 120 = 2 hours)
  intervalMinutes: {
    type: Number,
    default: 120,
    min: 15,
    max: 43200 // max 30 days
  },

  // Index tracking which post in the list is currently active
  currentIndex: {
    type: Number,
    default: 0,
    min: 0
  },

  // When the rotation was last updated
  lastRotatedAt: {
    type: Date,
    default: Date.now
  },

  // Admin who last updated the spotlight config
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update the `updatedAt` timestamp
spotlightConfigSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const SpotlightConfigModel = mongoose.model('SpotlightConfig', spotlightConfigSchema);
