import mongoose from 'mongoose';

const loginStreakSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dateKey: { type: String, required: true, index: true },
  timezone: { type: String, default: 'Africa/Lagos' },
  startedAt: { type: Date, default: Date.now },
  lastPingAt: { type: Date, default: Date.now },
  activeSecondsAccumulated: { type: Number, default: 0, min: 0 },
  requiredActiveSeconds: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['started', 'qualified'],
    default: 'started',
    index: true,
  },
  qualifiedAt: { type: Date, default: null },
  rewardPointsGranted: { type: Number, default: 0, min: 0 },
  streakAfterQualification: { type: Number, default: 0, min: 0 },
  payoutCycleDayAfterQualification: { type: Number, default: 0, min: 0 },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

loginStreakSessionSchema.index({ user: 1, dateKey: 1 }, { unique: true });
loginStreakSessionSchema.index({ status: 1, dateKey: 1, user: 1 });

export const LoginStreakSessionModel = mongoose.model('LoginStreakSession', loginStreakSessionSchema);
