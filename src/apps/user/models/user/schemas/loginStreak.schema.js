import mongoose from 'mongoose';

const loginStreakSchema = new mongoose.Schema({
  currentStreak: { type: Number, default: 0, min: 0 },
  longestStreak: { type: Number, default: 0, min: 0 },
  lastQualifiedDateKey: { type: String, default: null },
  lastQualifiedAt: { type: Date, default: null },
  rewardCycleDayCount: { type: Number, default: 0, min: 0 },
  pendingCyclePoints: { type: Number, default: 0, min: 0 },
  withdrawablePoints: { type: Number, default: 0, min: 0 },
  totalPointsEarned: { type: Number, default: 0, min: 0 },
  totalPointsWithdrawn: { type: Number, default: 0, min: 0 },
  totalNairaWithdrawn: { type: Number, default: 0, min: 0 },
  lastRewardPoints: { type: Number, default: 0, min: 0 },
  lastRewardDateKey: { type: String, default: null },
  lastWithdrawalAt: { type: Date, default: null },
}, { _id: false });

export default loginStreakSchema;
