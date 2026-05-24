import mongoose from 'mongoose';

// Lightweight preference document keyed by user.
// This is intentionally simple for incremental rollout; we can evolve to per-channel/per-type rules later.
const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    mutedCategories: {
      type: [String],
      default: [],
    },

    mutedTypes: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export default notificationPreferenceSchema;

