import mongoose from "mongoose";

const userDismissalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  dismissedNotifications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BannerMessage',
    required: true,
    index: true
  }],
  // Track when each notification was dismissed
  dismissedAt: {
    type: Map,
    of: Date,
    default: {}
  },
  // Track dismissal counts per user
  dismissalCount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Last dismissal timestamp
  lastDismissedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

export default userDismissalSchema;