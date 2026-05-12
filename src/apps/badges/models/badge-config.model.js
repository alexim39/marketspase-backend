import mongoose from 'mongoose';

const levelThresholdSchema = new mongoose.Schema({
  level: { type: Number, required: true, min: 1 },
  title: { type: String, required: true, trim: true },
  minExperiencePoints: { type: Number, required: true, min: 0 },
}, { _id: false });

const badgeConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true, index: true },
  enabled: { type: Boolean, default: true },
  feedRefreshMinutes: { type: Number, default: 15, min: 1, max: 1440 },
  evaluationCooldownMinutes: { type: Number, default: 10, min: 1, max: 1440 },
  celebrationWindowHours: { type: Number, default: 72, min: 1, max: 720 },
  levelThresholds: {
    type: [levelThresholdSchema],
    default: () => [
      { level: 1, title: 'Starter', minExperiencePoints: 0 },
      { level: 2, title: 'Consistent', minExperiencePoints: 40 },
      { level: 3, title: 'Momentum', minExperiencePoints: 90 },
      { level: 4, title: 'Closer', minExperiencePoints: 160 },
      { level: 5, title: 'Market Mover', minExperiencePoints: 250 },
      { level: 6, title: 'Powerhouse', minExperiencePoints: 360 },
    ],
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

export const BadgeConfigModel = mongoose.model('BadgeConfig', badgeConfigSchema);
