import mongoose from 'mongoose';

const userBadgeRewardSnapshotSchema = new mongoose.Schema({
  experiencePoints: { type: Number, default: 0, min: 0 },
  label: { type: String, trim: true, default: '' },
}, { _id: false });

const userBadgeCriteriaSnapshotSchema = new mongoose.Schema({
  metric: { type: String, required: true, trim: true },
  comparison: { type: String, default: 'gte', trim: true },
  targetValue: { type: Number, required: true, min: 1 },
}, { _id: false });

const userBadgeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  badge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BadgeDefinition',
    required: true,
    index: true,
  },
  badgeKey: { type: String, required: true, trim: true, index: true },
  titleSnapshot: { type: String, required: true, trim: true },
  descriptionSnapshot: { type: String, required: true, trim: true },
  shortDescriptionSnapshot: { type: String, trim: true, default: '' },
  iconSnapshot: { type: String, default: 'military_tech', trim: true },
  accentColorSnapshot: { type: String, default: '#7c3aed', trim: true },
  categorySnapshot: { type: String, default: 'engagement', trim: true },
  rewardSnapshot: { type: userBadgeRewardSnapshotSchema, default: () => ({}) },
  criteriaSnapshot: { type: userBadgeCriteriaSnapshotSchema, required: true },
  metricValueAtUnlock: { type: Number, default: 0, min: 0 },
  progressPercentAtUnlock: { type: Number, default: 100, min: 0, max: 100 },
  sourceEvent: { type: String, default: 'system', trim: true },
  unlockedAt: { type: Date, default: Date.now, index: true },
  notifiedAt: { type: Date, default: null },
}, { timestamps: true });

userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });
userBadgeSchema.index({ user: 1, unlockedAt: -1 });
userBadgeSchema.index({ badgeKey: 1, unlockedAt: -1 });

export const UserBadgeModel = mongoose.model('UserBadge', userBadgeSchema);
