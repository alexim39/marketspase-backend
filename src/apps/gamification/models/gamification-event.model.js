import mongoose from 'mongoose';
import { GAMIFICATION_CATEGORIES } from './gamification.constants.js';

const gamificationEventSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  actionKey: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  category: {
    type: String,
    enum: GAMIFICATION_CATEGORIES,
    default: 'engagement',
  },
  sourceKey: {
    type: String,
    required: true,
    trim: true,
  },
  sourceType: {
    type: String,
    default: 'system',
    trim: true,
  },
  sourceId: {
    type: String,
    default: null,
    trim: true,
  },
  labelSnapshot: {
    type: String,
    required: true,
    trim: true,
  },
  descriptionSnapshot: {
    type: String,
    default: '',
    trim: true,
  },
  experiencePointsAwarded: {
    type: Number,
    default: 0,
    min: 0,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  occurredAt: {
    type: Date,
    default: Date.now,
  },
  awardedAt: {
    type: Date,
    default: Date.now,
  },
  profileSnapshot: {
    totalExperiencePoints: { type: Number, default: 0, min: 0 },
    currentLevel: { type: Number, default: 1, min: 1 },
    currentLevelTitle: { type: String, default: 'Starter', trim: true },
  },
}, {
  timestamps: true,
});

gamificationEventSchema.index({ user: 1, actionKey: 1, sourceKey: 1 }, { unique: true });
gamificationEventSchema.index({ user: 1, awardedAt: -1 });

export const GamificationEventModel = mongoose.models.GamificationEvent
  || mongoose.model('GamificationEvent', gamificationEventSchema);
