import mongoose from 'mongoose';

const engagementContractSchema = new mongoose.Schema({
  marketerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  promoterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'active', 'milestone-review', 'completed', 'disputed', 'cancelled'],
    default: 'pending',
    index: true
  },

  tasks: [{
    type: { type: String, enum: ['like', 'comment', 'share', 'follow', 'content-create'], required: true },
    target: { type: Number, required: true, min: 1 },
    completed: { type: Number, default: 0, min: 0 },
    platform: { type: String },
    qualityRequired: { type: Boolean, default: false },
    description: { type: String, trim: true }
  }],

  payment: {
    total: { type: Number, required: true, min: 0 },
    released: { type: Number, default: 0, min: 0 },
    platformFee: { type: Number, default: 0.2 },
    schedule: { type: String, enum: ['on-completion', 'milestone', 'weekly'], default: 'on-completion' },
    milestones: [{
      percent: { type: Number, required: true },
      description: { type: String, trim: true },
      completed: { type: Boolean, default: false },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      releasedAt: Date
    }]
  },

  duration: {
    start: Date,
    end: Date
  },

  progress: { type: Number, default: 0, min: 0, max: 100 },
  contractTerms: { type: String, trim: true },

  // Ratings after completion
  marketerRating: { rating: { type: Number, min: 1, max: 5 }, review: String },
  promoterFeedback: { rating: { type: Number, min: 1, max: 5 }, review: String },

  // Auto-tracking (linked feed posts)
  trackedPostIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FeedPost' }],

  escrowId: { type: mongoose.Schema.Types.ObjectId, ref: 'EngagementEscrow' },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

engagementContractSchema.index({ status: 1, createdAt: -1 });
engagementContractSchema.index({ marketerId: 1, status: 1 });
engagementContractSchema.index({ promoterId: 1, status: 1 });

engagementContractSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const EngagementContractModel = mongoose.model('EngagementContract', engagementContractSchema);

// Engagement Escrow Schema
const engagementEscrowSchema = new mongoose.Schema({
  contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'EngagementContract', required: true, unique: true },
  marketerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  promoterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0 },
  released: { type: Number, default: 0 },
  status: { type: String, enum: ['held', 'partially-released', 'fully-released', 'refunded'], default: 'held' },
  releaseSchedule: { type: String, enum: ['on-completion', 'milestone', 'weekly'] },
  releases: [{
    amount: Number,
    reason: String,
    releasedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

engagementEscrowSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const EngagementEscrowModel = mongoose.model('EngagementEscrow', engagementEscrowSchema);
