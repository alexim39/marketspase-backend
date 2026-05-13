import mongoose from 'mongoose';

const rewardDaySchema = new mongoose.Schema({
  day: { type: Number, required: true, min: 1 },
  points: { type: Number, required: true, min: 0 },
}, { _id: false });

const leaderboardSettingsSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  defaultMetric: {
    type: String,
    enum: ['streak', 'points', 'blended'],
    default: 'blended',
  },
  enabledMetrics: {
    type: [String],
    default: () => ['streak', 'points', 'blended'],
    validate: {
      validator: (metrics) => Array.isArray(metrics) && metrics.length > 0,
      message: 'At least one leaderboard metric must be enabled.',
    },
  },
  defaultTimeframe: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'weekly',
  },
  refreshIntervalMinutes: { type: Number, default: 60, min: 5, max: 1440 },
  topSize: { type: Number, default: 10, min: 3, max: 50 },
}, { _id: false });

const loginStreakConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true, index: true },
  enabled: { type: Boolean, default: true },
  timezone: { type: String, default: 'Africa/Lagos' },
  minimumSessionMinutes: { type: Number, default: 15, min: 1 },
  cycleLengthDays: { type: Number, default: 7, min: 1 },
  pointValueNaira: { type: Number, default: 150, min: 1 },
  dailyRewards: {
    type: [rewardDaySchema],
    default: () => Array.from({ length: 7 }, (_, index) => ({
      day: index + 1,
      points: 1,
    })),
  },
  leaderboard: {
    type: leaderboardSettingsSchema,
    default: () => ({}),
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

export const LoginStreakConfigModel = mongoose.model('LoginStreakConfig', loginStreakConfigSchema);
