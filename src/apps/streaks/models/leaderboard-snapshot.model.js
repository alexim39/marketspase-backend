import mongoose from 'mongoose';

const leaderboardEntrySchema = new mongoose.Schema({
  rank: { type: Number, required: true, min: 1 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uid: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, default: null },
  role: {
    type: String,
    enum: ['marketer', 'promoter'],
    required: true,
  },
  currentStreak: { type: Number, default: 0, min: 0 },
  longestStreak: { type: Number, default: 0, min: 0 },
  timeframeQualifiedDays: { type: Number, default: 0, min: 0 },
  timeframeBestStreak: { type: Number, default: 0, min: 0 },
  timeframePoints: { type: Number, default: 0, min: 0 },
  totalPointsEarned: { type: Number, default: 0, min: 0 },
  score: { type: Number, default: 0, min: 0 },
}, { _id: false });

const leaderboardSnapshotSchema = new mongoose.Schema({
  timeframe: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true,
    index: true,
  },
  metric: {
    type: String,
    enum: ['streak', 'points', 'blended'],
    required: true,
    index: true,
  },
  periodKey: { type: String, required: true, index: true },
  periodStartedAt: { type: Date, required: true },
  periodEndsAt: { type: Date, required: true },
  limit: { type: Number, required: true, min: 1 },
  totalEligibleUsers: { type: Number, default: 0, min: 0 },
  computedAt: { type: Date, default: Date.now, index: true },
  entries: { type: [leaderboardEntrySchema], default: [] },
  meta: {
    type: {
      periodLabel: { type: String, default: null },
      periodRangeLabel: { type: String, default: null },
    },
    default: () => ({}),
  },
}, { timestamps: true });

leaderboardSnapshotSchema.index(
  { timeframe: 1, metric: 1, periodKey: 1 },
  { unique: true }
);

export const LeaderboardSnapshotModel = mongoose.model(
  'LeaderboardSnapshot',
  leaderboardSnapshotSchema
);
