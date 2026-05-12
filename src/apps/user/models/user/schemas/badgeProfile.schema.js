import mongoose from 'mongoose';

const badgeProfileSchema = new mongoose.Schema({
  level: { type: Number, default: 1, min: 1 },
  levelTitle: { type: String, default: 'Starter', trim: true },
  experiencePoints: { type: Number, default: 0, min: 0 },
  badgesEarned: { type: Number, default: 0, min: 0 },
  lastBadgeUnlockedAt: { type: Date, default: null },
  lastBadgeKey: { type: String, default: null, trim: true },
  lastEvaluatedAt: { type: Date, default: null },
}, { _id: false });

export default badgeProfileSchema;
