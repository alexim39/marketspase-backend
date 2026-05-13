import mongoose from 'mongoose';

const userGamificationMilestoneSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  milestoneKey: {
    type: String,
    required: true,
    trim: true,
  },
  titleSnapshot: {
    type: String,
    required: true,
    trim: true,
  },
  descriptionSnapshot: {
    type: String,
    default: '',
    trim: true,
  },
  rewardLabelSnapshot: {
    type: String,
    default: '',
    trim: true,
  },
  linkedBadgeKeySnapshot: {
    type: String,
    default: null,
    trim: true,
  },
  featureKeySnapshot: {
    type: String,
    default: null,
    trim: true,
  },
  iconSnapshot: {
    type: String,
    default: 'military_tech',
    trim: true,
  },
  accentColorSnapshot: {
    type: String,
    default: '#7c3aed',
    trim: true,
  },
  minLevel: {
    type: Number,
    required: true,
    min: 1,
  },
  sourceLevel: {
    type: Number,
    required: true,
    min: 1,
  },
  unlockedAt: {
    type: Date,
    default: Date.now,
  },
  notifiedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

userGamificationMilestoneSchema.index({ user: 1, milestoneKey: 1 }, { unique: true });
userGamificationMilestoneSchema.index({ user: 1, unlockedAt: -1 });

export const UserGamificationMilestoneModel = mongoose.models.UserGamificationMilestone
  || mongoose.model('UserGamificationMilestone', userGamificationMilestoneSchema);
