import mongoose from 'mongoose';
import {
  DEFAULT_GAMIFICATION_LEVEL_THRESHOLDS,
  GAMIFICATION_CATEGORIES,
  GAMIFICATION_ROLES,
} from './gamification.constants.js';

const actionRuleSchema = new mongoose.Schema({
  actionKey: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  category: { type: String, enum: GAMIFICATION_CATEGORIES, default: 'engagement' },
  roles: {
    type: [{ type: String, enum: GAMIFICATION_ROLES }],
    default: ['all'],
  },
  icon: { type: String, default: 'stars', trim: true },
  accentColor: { type: String, default: '#7c3aed', trim: true },
  experiencePoints: { type: Number, default: 0, min: 0 },
  useMetadataExperiencePoints: { type: Boolean, default: false },
  metadataExperiencePointsField: { type: String, default: null, trim: true },
  multiplier: { type: Number, default: 1, min: 0 },
  maxExperiencePointsPerEvent: { type: Number, default: null, min: 0 },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0, min: 0 },
}, { _id: false });

const levelThresholdSchema = new mongoose.Schema({
  level: { type: Number, required: true, min: 1 },
  title: { type: String, required: true, trim: true },
  minExperiencePoints: { type: Number, required: true, min: 0 },
  description: { type: String, default: '', trim: true },
  rewardLabel: { type: String, default: '', trim: true },
  linkedBadgeKey: { type: String, default: null, trim: true },
  featureKey: { type: String, default: null, trim: true },
  icon: { type: String, default: 'military_tech', trim: true },
  accentColor: { type: String, default: '#7c3aed', trim: true },
}, { _id: false });

const gamificationConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'default' },
  enabled: { type: Boolean, default: true },
  refreshIntervalMinutes: { type: Number, default: 15, min: 1 },
  celebrationWindowHours: { type: Number, default: 72, min: 1 },
  actionRules: {
    type: [actionRuleSchema],
    default: [],
  },
  levelThresholds: {
    type: [levelThresholdSchema],
    default: DEFAULT_GAMIFICATION_LEVEL_THRESHOLDS,
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, {
  timestamps: true,
});

export const GamificationConfigModel = mongoose.models.GamificationConfig
  || mongoose.model('GamificationConfig', gamificationConfigSchema);
