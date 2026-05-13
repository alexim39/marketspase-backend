import mongoose from 'mongoose';

const gamificationProfileSchema = new mongoose.Schema({
  totalExperiencePoints: { type: Number, default: 0, min: 0 },
  currentLevel: { type: Number, default: 1, min: 1 },
  currentLevelTitle: { type: String, default: 'Starter', trim: true },
  currentLevelMinExperiencePoints: { type: Number, default: 0, min: 0 },
  nextLevel: { type: Number, default: null, min: 1 },
  nextLevelTitle: { type: String, default: null, trim: true },
  nextLevelMinExperiencePoints: { type: Number, default: null, min: 0 },
  experiencePointsToNextLevel: { type: Number, default: 0, min: 0 },
  progressPercent: { type: Number, default: 0, min: 0, max: 100 },
  totalEvents: { type: Number, default: 0, min: 0 },
  milestonesUnlocked: { type: Number, default: 0, min: 0 },
  badgesUnlocked: { type: Number, default: 0, min: 0 },
  lastActionKey: { type: String, default: null, trim: true },
  lastExperiencePointsAwarded: { type: Number, default: 0, min: 0 },
  lastEventAt: { type: Date, default: null },
  recentLevelUpAt: { type: Date, default: null },
  highestLevelReachedAt: { type: Date, default: null },
  lastMilestoneKey: { type: String, default: null, trim: true },
  lastMilestoneUnlockedAt: { type: Date, default: null },
  lastCalculatedAt: { type: Date, default: null },
}, { _id: false });

export default gamificationProfileSchema;
