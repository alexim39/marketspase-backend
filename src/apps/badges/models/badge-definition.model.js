import mongoose from 'mongoose';

export const BADGE_ROLES = ['all', 'marketer', 'promoter'];
export const BADGE_CATEGORIES = ['streak', 'points', 'campaigns', 'promotions', 'sales', 'community', 'engagement'];
export const BADGE_METRICS = [
  'login_streak_current',
  'login_streak_longest',
  'login_points_total',
  'campaigns_created',
  'campaign_clicks_billable',
  'promotions_accepted',
  'promotion_clicks_billable',
  'affiliate_sales_count',
  'affiliate_commission_total',
  'store_orders_paid',
  'community_posts_published',
  'followers_count',
  'forum_threads_created',
  'forum_comments_created',
  'forum_engagement_score',
];

const badgeCriteriaSchema = new mongoose.Schema({
  metric: {
    type: String,
    enum: BADGE_METRICS,
    required: true,
  },
  comparison: {
    type: String,
    enum: ['gte'],
    default: 'gte',
  },
  targetValue: {
    type: Number,
    required: true,
    min: 1,
  },
}, { _id: false });

const badgeRewardSchema = new mongoose.Schema({
  experiencePoints: { type: Number, default: 10, min: 0 },
  label: { type: String, trim: true, default: '' },
}, { _id: false });

const badgeDefinitionSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true, trim: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  shortDescription: { type: String, trim: true },
  icon: { type: String, default: 'military_tech', trim: true },
  accentColor: { type: String, default: '#7c3aed', trim: true },
  category: {
    type: String,
    enum: BADGE_CATEGORIES,
    default: 'engagement',
    index: true,
  },
  roles: {
    type: [String],
    enum: BADGE_ROLES,
    default: () => ['all'],
  },
  criteria: {
    type: badgeCriteriaSchema,
    required: true,
  },
  reward: {
    type: badgeRewardSchema,
    default: () => ({}),
  },
  isActive: { type: Boolean, default: true, index: true },
  isFeatured: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

badgeDefinitionSchema.index({ isActive: 1, sortOrder: 1, category: 1 });
badgeDefinitionSchema.index({ 'criteria.metric': 1, isActive: 1 });

export const BadgeDefinitionModel = mongoose.model('BadgeDefinition', badgeDefinitionSchema);
