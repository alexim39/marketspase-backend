import mongoose from 'mongoose';

export const dailyMissionSchema = new mongoose.Schema({
  date: { type: Date },
  label: { type: String },
  requirements: [{
    type: { type: String, enum: ['like', 'comment', 'share', 'follow'] },
    target: { type: Number, default: 0 },
    completed: { type: Number, default: 0 }
  }],
  reward: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  claimedAt: { type: Date }
}, { _id: false });

export const engagementStreakSchema = new mongoose.Schema({
  current: { type: Number, default: 0 },
  longest: { type: Number, default: 0 },
  lastActiveDate: { type: Date }
}, { _id: false });
