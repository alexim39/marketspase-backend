import mongoose from 'mongoose';

const followSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  createdAt: { type: Date, default: Date.now },
});

// Ensure a user can't follow the same person twice
followSchema.index({ follower: 1, following: 1 }, { unique: true });

export const FollowModel = mongoose.model('Follow', followSchema);