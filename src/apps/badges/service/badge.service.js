import mongoose from 'mongoose';
import { CampaignModel } from '../../campaign/models/campaign.model.js';
import { FeedPostModel } from '../../feeds/models/feed/index.js';
import { NotificationService } from '../../notification/services/notification.service.js';
import { FollowModel } from '../../profile/models/follow/index.js';
import { PromotionModel } from '../../promotion/models/promotion.model.js';
import { OrderModel } from '../../store/models/order/index.js';
import { UserModel } from '../../user/models/user/index.js';
import {
  BADGE_CATEGORIES,
  BADGE_METRICS,
  BADGE_ROLES,
  BadgeConfigModel,
  BadgeDefinitionModel,
  UserBadgeModel,
} from '../models/index.js';

const DEFAULT_CONFIG = {
  enabled: true,
  feedRefreshMinutes: 15,
  evaluationCooldownMinutes: 10,
  celebrationWindowHours: 72,
  levelThresholds: [
    { level: 1, title: 'Starter', minExperiencePoints: 0 },
    { level: 2, title: 'Consistent', minExperiencePoints: 40 },
    { level: 3, title: 'Momentum', minExperiencePoints: 90 },
    { level: 4, title: 'Closer', minExperiencePoints: 160 },
    { level: 5, title: 'Market Mover', minExperiencePoints: 250 },
    { level: 6, title: 'Powerhouse', minExperiencePoints: 360 },
  ],
};

const DEFAULT_BADGE_DEFINITIONS = [
  {
    key: 'streak-3',
    title: 'Consistency Starter',
    description: 'Log in and qualify for 3 consecutive days.',
    shortDescription: '3-day login streak',
    icon: 'local_fire_department',
    accentColor: '#f97316',
    category: 'streak',
    roles: ['all'],
    criteria: { metric: 'login_streak_current', targetValue: 3 },
    reward: { experiencePoints: 10, label: '10 XP' },
    sortOrder: 10,
  },
  {
    key: 'streak-7',
    title: 'Week on Fire',
    description: 'Keep your streak alive for 7 consecutive qualified days.',
    shortDescription: '7-day login streak',
    icon: 'whatshot',
    accentColor: '#ef4444',
    category: 'streak',
    roles: ['all'],
    criteria: { metric: 'login_streak_current', targetValue: 7 },
    reward: { experiencePoints: 20, label: '20 XP' },
    sortOrder: 20,
  },
  {
    key: 'points-25',
    title: 'Point Builder',
    description: 'Earn 25 total login reward points on MarketSpase.',
    shortDescription: 'Earn 25 points',
    icon: 'stars',
    accentColor: '#8b5cf6',
    category: 'points',
    roles: ['all'],
    criteria: { metric: 'login_points_total', targetValue: 25 },
    reward: { experiencePoints: 20, label: '20 XP' },
    sortOrder: 30,
  },
  {
    key: 'points-100',
    title: 'Reward Collector',
    description: 'Accumulate 100 total reward points from daily streaks.',
    shortDescription: 'Earn 100 points',
    icon: 'workspace_premium',
    accentColor: '#7c3aed',
    category: 'points',
    roles: ['all'],
    criteria: { metric: 'login_points_total', targetValue: 100 },
    reward: { experiencePoints: 35, label: '35 XP' },
    sortOrder: 40,
  },
  {
    key: 'campaigns-1',
    title: 'Campaign Launcher',
    description: 'Create your first campaign as a marketer.',
    shortDescription: 'Create 1 campaign',
    icon: 'rocket_launch',
    accentColor: '#2563eb',
    category: 'campaigns',
    roles: ['marketer'],
    criteria: { metric: 'campaigns_created', targetValue: 1 },
    reward: { experiencePoints: 15, label: '15 XP' },
    sortOrder: 50,
  },
  {
    key: 'campaigns-5',
    title: 'Growth Planner',
    description: 'Launch 5 campaigns and keep momentum building.',
    shortDescription: 'Create 5 campaigns',
    icon: 'campaign',
    accentColor: '#1d4ed8',
    category: 'campaigns',
    roles: ['marketer'],
    criteria: { metric: 'campaigns_created', targetValue: 5 },
    reward: { experiencePoints: 30, label: '30 XP' },
    sortOrder: 60,
  },
  {
    key: 'campaign-clicks-100',
    title: 'Traffic Driver',
    description: 'Generate 100 billable clicks across your campaigns.',
    shortDescription: '100 campaign clicks',
    icon: 'ads_click',
    accentColor: '#0f766e',
    category: 'campaigns',
    roles: ['marketer'],
    criteria: { metric: 'campaign_clicks_billable', targetValue: 100 },
    reward: { experiencePoints: 35, label: '35 XP' },
    sortOrder: 70,
  },
  {
    key: 'promotions-1',
    title: 'Promotion Starter',
    description: 'Accept your first ad promotion as a promoter.',
    shortDescription: 'Accept 1 promotion',
    icon: 'celebration',
    accentColor: '#f59e0b',
    category: 'promotions',
    roles: ['promoter'],
    criteria: { metric: 'promotions_accepted', targetValue: 1 },
    reward: { experiencePoints: 15, label: '15 XP' },
    sortOrder: 80,
  },
  {
    key: 'promotions-10',
    title: 'Promotion Runner',
    description: 'Accept 10 promotions and keep sharing consistently.',
    shortDescription: 'Accept 10 promotions',
    icon: 'speed',
    accentColor: '#f97316',
    category: 'promotions',
    roles: ['promoter'],
    criteria: { metric: 'promotions_accepted', targetValue: 10 },
    reward: { experiencePoints: 30, label: '30 XP' },
    sortOrder: 90,
  },
  {
    key: 'promotion-clicks-100',
    title: 'Click Magnet',
    description: 'Drive 100 billable clicks from your promotion links.',
    shortDescription: '100 promotion clicks',
    icon: 'bolt',
    accentColor: '#eab308',
    category: 'promotions',
    roles: ['promoter'],
    criteria: { metric: 'promotion_clicks_billable', targetValue: 100 },
    reward: { experiencePoints: 35, label: '35 XP' },
    sortOrder: 100,
  },
  {
    key: 'affiliate-sales-5',
    title: 'Closer',
    description: 'Refer 5 paid storefront sales through your product links.',
    shortDescription: '5 affiliate sales',
    icon: 'shopping_bag',
    accentColor: '#16a34a',
    category: 'sales',
    roles: ['promoter'],
    criteria: { metric: 'affiliate_sales_count', targetValue: 5 },
    reward: { experiencePoints: 40, label: '40 XP' },
    sortOrder: 110,
  },
  {
    key: 'store-orders-10',
    title: 'Store Performer',
    description: 'Record 10 paid storefront orders on your store.',
    shortDescription: '10 store orders',
    icon: 'storefront',
    accentColor: '#059669',
    category: 'sales',
    roles: ['marketer'],
    criteria: { metric: 'store_orders_paid', targetValue: 10 },
    reward: { experiencePoints: 40, label: '40 XP' },
    sortOrder: 120,
  },
  {
    key: 'community-posts-3',
    title: 'Community Voice',
    description: 'Publish 3 campaign updates in the MarketSpase community.',
    shortDescription: '3 community posts',
    icon: 'forum',
    accentColor: '#06b6d4',
    category: 'community',
    roles: ['marketer'],
    criteria: { metric: 'community_posts_published', targetValue: 3 },
    reward: { experiencePoints: 20, label: '20 XP' },
    sortOrder: 130,
  },
];

const BADGE_METRIC_CATALOG = [
  { value: 'login_streak_current', label: 'Current login streak', unit: 'days', category: 'streak' },
  { value: 'login_streak_longest', label: 'Longest login streak', unit: 'days', category: 'streak' },
  { value: 'login_points_total', label: 'Total streak points earned', unit: 'points', category: 'points' },
  { value: 'campaigns_created', label: 'Campaigns created', unit: 'campaigns', category: 'campaigns' },
  { value: 'campaign_clicks_billable', label: 'Billable campaign clicks', unit: 'clicks', category: 'campaigns' },
  { value: 'promotions_accepted', label: 'Promotions accepted', unit: 'promotions', category: 'promotions' },
  { value: 'promotion_clicks_billable', label: 'Billable promotion clicks', unit: 'clicks', category: 'promotions' },
  { value: 'affiliate_sales_count', label: 'Affiliate sales referred', unit: 'sales', category: 'sales' },
  { value: 'affiliate_commission_total', label: 'Affiliate commission earned', unit: 'NGN', category: 'sales' },
  { value: 'store_orders_paid', label: 'Paid storefront orders', unit: 'orders', category: 'sales' },
  { value: 'community_posts_published', label: 'Community posts published', unit: 'posts', category: 'community' },
  { value: 'followers_count', label: 'Followers', unit: 'followers', category: 'community' },
];

const toObjectId = (value) => new mongoose.Types.ObjectId(value);
const toNumber = (value) => Number(value || 0);
const roundMetric = (value) => Math.round(toNumber(value) * 100) / 100;
const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value)));

const normalizeRoles = (roles) => {
  const values = Array.isArray(roles) ? roles : [roles || 'all'];
  const normalized = [...new Set(values
    .map((value) => String(value || '').trim())
    .filter((value) => BADGE_ROLES.includes(value)))];
  return normalized.length ? normalized : ['all'];
};

const normalizeLevelThresholds = (thresholds = []) => {
  const source = Array.isArray(thresholds) && thresholds.length
    ? thresholds
    : DEFAULT_CONFIG.levelThresholds;

  const sorted = [...source]
    .map((threshold, index) => ({
      level: Math.max(1, Number(threshold.level || index + 1)),
      title: String(threshold.title || `Level ${index + 1}`).trim() || `Level ${index + 1}`,
      minExperiencePoints: Math.max(0, Number(threshold.minExperiencePoints || 0)),
    }))
    .sort((left, right) => (
      left.level - right.level ||
      left.minExperiencePoints - right.minExperiencePoints
    ));

  const deduped = [];
  for (const threshold of sorted) {
    if (!deduped.find((entry) => entry.level === threshold.level)) {
      deduped.push(threshold);
    }
  }

  if (!deduped.length || deduped[0].level !== 1 || deduped[0].minExperiencePoints !== 0) {
    deduped.unshift({
      level: 1,
      title: deduped[0]?.level === 1 ? deduped[0].title : 'Starter',
      minExperiencePoints: 0,
    });
  }

  return deduped.map((threshold, index) => ({
    level: index + 1,
    title: threshold.title,
    minExperiencePoints: index === 0 ? 0 : Math.max(threshold.minExperiencePoints, deduped[index - 1].minExperiencePoints + 1),
  }));
};

const findCurrentLevel = (experiencePoints, thresholds) => {
  const normalizedXp = Math.max(0, toNumber(experiencePoints));
  const normalizedThresholds = normalizeLevelThresholds(thresholds);
  let current = normalizedThresholds[0];
  let next = null;

  for (let index = 0; index < normalizedThresholds.length; index += 1) {
    const threshold = normalizedThresholds[index];
    const upcoming = normalizedThresholds[index + 1] || null;
    if (normalizedXp >= threshold.minExperiencePoints) {
      current = threshold;
      next = upcoming;
    }
  }

  return {
    current,
    next,
    normalizedThresholds,
  };
};

const buildLevelSummary = (experiencePoints, thresholds) => {
  const { current, next } = findCurrentLevel(experiencePoints, thresholds);
  const currentMin = current?.minExperiencePoints || 0;
  const nextMin = next?.minExperiencePoints || currentMin;
  const progressPercent = next
    ? clampPercent(((experiencePoints - currentMin) / Math.max(1, nextMin - currentMin)) * 100)
    : 100;

  return {
    level: current?.level || 1,
    levelTitle: current?.title || 'Starter',
    experiencePoints: roundMetric(experiencePoints),
    currentLevelMinExperiencePoints: currentMin,
    nextLevel: next?.level || null,
    nextLevelTitle: next?.title || null,
    nextLevelMinExperiencePoints: nextMin || null,
    experiencePointsToNextLevel: next ? Math.max(0, nextMin - roundMetric(experiencePoints)) : 0,
    progressPercent,
  };
};

const isBadgeApplicableToRole = (definition, role) => {
  const roles = normalizeRoles(definition.roles);
  return roles.includes('all') || roles.includes(role);
};

const mapMetricCatalogEntry = (metric) => {
  const entry = BADGE_METRIC_CATALOG.find((candidate) => candidate.value === metric);
  return entry || { value: metric, label: metric, unit: 'units', category: 'engagement' };
};

const formatBadgeDefinition = (definition) => ({
  id: definition._id?.toString?.() || definition.id,
  key: definition.key,
  title: definition.title,
  description: definition.description,
  shortDescription: definition.shortDescription || '',
  icon: definition.icon || 'military_tech',
  accentColor: definition.accentColor || '#7c3aed',
  category: definition.category || 'engagement',
  roles: normalizeRoles(definition.roles),
  criteria: {
    metric: definition.criteria.metric,
    comparison: definition.criteria.comparison || 'gte',
    targetValue: toNumber(definition.criteria.targetValue),
    metricLabel: mapMetricCatalogEntry(definition.criteria.metric).label,
    metricUnit: mapMetricCatalogEntry(definition.criteria.metric).unit,
  },
  reward: {
    experiencePoints: toNumber(definition.reward?.experiencePoints),
    label: definition.reward?.label || '',
  },
  isActive: Boolean(definition.isActive),
  isFeatured: Boolean(definition.isFeatured),
  sortOrder: toNumber(definition.sortOrder),
  createdAt: definition.createdAt || null,
  updatedAt: definition.updatedAt || null,
});

const formatUserBadge = (userBadge) => ({
  id: userBadge._id?.toString?.() || userBadge.id,
  badgeId: userBadge.badge?.toString?.() || userBadge.badgeId || null,
  key: userBadge.badgeKey,
  title: userBadge.titleSnapshot,
  description: userBadge.descriptionSnapshot,
  shortDescription: userBadge.shortDescriptionSnapshot || '',
  icon: userBadge.iconSnapshot || 'military_tech',
  accentColor: userBadge.accentColorSnapshot || '#7c3aed',
  category: userBadge.categorySnapshot || 'engagement',
  reward: {
    experiencePoints: toNumber(userBadge.rewardSnapshot?.experiencePoints),
    label: userBadge.rewardSnapshot?.label || '',
  },
  criteria: {
    metric: userBadge.criteriaSnapshot?.metric,
    comparison: userBadge.criteriaSnapshot?.comparison || 'gte',
    targetValue: toNumber(userBadge.criteriaSnapshot?.targetValue),
    metricLabel: mapMetricCatalogEntry(userBadge.criteriaSnapshot?.metric).label,
    metricUnit: mapMetricCatalogEntry(userBadge.criteriaSnapshot?.metric).unit,
  },
  metricValueAtUnlock: roundMetric(userBadge.metricValueAtUnlock),
  progressPercentAtUnlock: clampPercent(userBadge.progressPercentAtUnlock),
  sourceEvent: userBadge.sourceEvent || 'system',
  unlockedAt: userBadge.unlockedAt || userBadge.createdAt || null,
  notifiedAt: userBadge.notifiedAt || null,
});

const aggregateNumericResult = async (pipeline, collection) => {
  const [result] = await collection.aggregate(pipeline);
  return roundMetric(result?.total || 0);
};

const normalizeDefinitionPayload = (payload = {}) => {
  const metric = String(payload?.criteria?.metric || '').trim();
  if (!BADGE_METRICS.includes(metric)) {
    throw new Error('Please choose a valid badge metric.');
  }

  const targetValue = Math.max(1, Number(payload?.criteria?.targetValue || 0));
  if (!Number.isFinite(targetValue)) {
    throw new Error('Badge target value must be a number.');
  }

  const key = String(payload.key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!key) {
    throw new Error('Badge key is required.');
  }

  const category = BADGE_CATEGORIES.includes(String(payload.category || '').trim())
    ? String(payload.category).trim()
    : mapMetricCatalogEntry(metric).category;

  return {
    key,
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim(),
    shortDescription: String(payload.shortDescription || '').trim(),
    icon: String(payload.icon || 'military_tech').trim() || 'military_tech',
    accentColor: String(payload.accentColor || '#7c3aed').trim() || '#7c3aed',
    category,
    roles: normalizeRoles(payload.roles),
    criteria: {
      metric,
      comparison: 'gte',
      targetValue,
    },
    reward: {
      experiencePoints: Math.max(0, Number(payload?.reward?.experiencePoints || 0)),
      label: String(payload?.reward?.label || '').trim(),
    },
    isActive: payload.isActive !== false,
    isFeatured: payload.isFeatured !== false,
    sortOrder: Math.max(0, Number(payload.sortOrder || 0)),
  };
};

const ensureBadgeConfig = async () => {
  const existing = await BadgeConfigModel.findOne({ key: 'default' });
  if (existing) {
    const normalizedThresholds = normalizeLevelThresholds(existing.levelThresholds || []);
    const thresholdsChanged = JSON.stringify(normalizedThresholds) !== JSON.stringify(existing.levelThresholds || []);
    let shouldSave = thresholdsChanged;

    if (thresholdsChanged) {
      existing.levelThresholds = normalizedThresholds;
    }

    if (!Number.isFinite(Number(existing.feedRefreshMinutes))) {
      existing.feedRefreshMinutes = DEFAULT_CONFIG.feedRefreshMinutes;
      shouldSave = true;
    }

    if (!Number.isFinite(Number(existing.evaluationCooldownMinutes))) {
      existing.evaluationCooldownMinutes = DEFAULT_CONFIG.evaluationCooldownMinutes;
      shouldSave = true;
    }

    if (!Number.isFinite(Number(existing.celebrationWindowHours))) {
      existing.celebrationWindowHours = DEFAULT_CONFIG.celebrationWindowHours;
      shouldSave = true;
    }

    if (shouldSave) {
      await existing.save();
    }

    return existing;
  }

  return BadgeConfigModel.create({
    key: 'default',
    ...DEFAULT_CONFIG,
  });
};

const ensureDefaultBadgeDefinitions = async () => {
  const existingDefinitions = await BadgeDefinitionModel.find({
    key: { $in: DEFAULT_BADGE_DEFINITIONS.map((badge) => badge.key) },
  }).select('key').lean();

  const existingKeys = new Set(existingDefinitions.map((badge) => badge.key));
  const missingDefinitions = DEFAULT_BADGE_DEFINITIONS.filter((badge) => !existingKeys.has(badge.key));

  if (missingDefinitions.length) {
    await BadgeDefinitionModel.insertMany(missingDefinitions, { ordered: false });
  }
};

const getMetricsForUser = async (userId, existingUser = null) => {
  const user = existingUser || await UserModel.findById(userId)
    .select('displayName avatar role loginStreak badgeProfile')
    .lean();

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const objectId = toObjectId(userId);

  const [
    campaignsCreated,
    campaignClicksBillable,
    promotionsAccepted,
    promotionClicksBillable,
    affiliateSalesCount,
    affiliateCommissionTotal,
    storeOrdersPaid,
    communityPostsPublished,
    followersCount,
  ] = await Promise.all([
    CampaignModel.countDocuments({ owner: objectId, isDeleted: { $ne: true } }),
    aggregateNumericResult([
      { $match: { owner: objectId, isDeleted: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$billableClicks' } } },
    ], CampaignModel),
    PromotionModel.countDocuments({ promoter: objectId, acceptedAt: { $ne: null } }),
    aggregateNumericResult([
      { $match: { promoter: objectId } },
      { $group: { _id: null, total: { $sum: '$clickStats.billableClicks' } } },
    ], PromotionModel),
    aggregateNumericResult([
      { $match: { paymentStatus: 'paid', isDeleted: { $ne: true }, 'items.promoterId': objectId } },
      { $unwind: '$items' },
      { $match: { 'items.promoterId': objectId } },
      { $group: { _id: null, total: { $sum: 1 } } },
    ], OrderModel),
    aggregateNumericResult([
      { $match: { paymentStatus: 'paid', isDeleted: { $ne: true }, 'items.promoterId': objectId } },
      { $unwind: '$items' },
      { $match: { 'items.promoterId': objectId } },
      { $group: { _id: null, total: { $sum: '$items.commissionEarned' } } },
    ], OrderModel),
    OrderModel.countDocuments({ marketer: objectId, paymentStatus: 'paid', isDeleted: { $ne: true } }),
    FeedPostModel.countDocuments({ author: objectId, status: 'published' }),
    FollowModel.countDocuments({ following: objectId }),
  ]);

  return {
    user,
    metrics: {
      login_streak_current: toNumber(user.loginStreak?.currentStreak),
      login_streak_longest: toNumber(user.loginStreak?.longestStreak),
      login_points_total: toNumber(user.loginStreak?.totalPointsEarned),
      campaigns_created: toNumber(campaignsCreated),
      campaign_clicks_billable: campaignClicksBillable,
      promotions_accepted: toNumber(promotionsAccepted),
      promotion_clicks_billable: promotionClicksBillable,
      affiliate_sales_count: affiliateSalesCount,
      affiliate_commission_total: affiliateCommissionTotal,
      store_orders_paid: toNumber(storeOrdersPaid),
      community_posts_published: toNumber(communityPostsPublished),
      followers_count: toNumber(followersCount),
    },
  };
};

const computeNextBadges = (definitions, earnedBadgeKeys, metrics, role, limit = 3) => {
  const candidates = definitions
    .filter((definition) => !earnedBadgeKeys.has(definition.key))
    .filter((definition) => isBadgeApplicableToRole(definition, role))
    .map((definition) => {
      const currentValue = roundMetric(metrics[definition.criteria.metric]);
      const targetValue = roundMetric(definition.criteria.targetValue);
      const progressPercent = clampPercent((currentValue / Math.max(1, targetValue)) * 100);
      return {
        ...formatBadgeDefinition(definition),
        progress: {
          currentValue,
          targetValue,
          remainingValue: Math.max(0, roundMetric(targetValue - currentValue)),
          progressPercent,
        },
      };
    })
    .sort((left, right) => (
      right.progress.progressPercent - left.progress.progressPercent ||
      left.progress.remainingValue - right.progress.remainingValue ||
      left.sortOrder - right.sortOrder
    ));

  return candidates.slice(0, limit);
};

const buildBadgeProfileSnapshot = async (userId, config, lastEvaluatedAt = new Date()) => {
  const objectId = toObjectId(userId);
  const [summary] = await UserBadgeModel.aggregate([
    { $match: { user: objectId } },
    {
      $group: {
        _id: null,
        experiencePoints: { $sum: '$rewardSnapshot.experiencePoints' },
        badgesEarned: { $sum: 1 },
        lastBadgeUnlockedAt: { $max: '$unlockedAt' },
      },
    },
  ]);

  const latestBadge = await UserBadgeModel.findOne({ user: objectId })
    .sort({ unlockedAt: -1, createdAt: -1 })
    .select('badgeKey')
    .lean();

  const experiencePoints = roundMetric(summary?.experiencePoints || 0);
  const badgesEarned = toNumber(summary?.badgesEarned || 0);
  const levelSummary = buildLevelSummary(experiencePoints, config.levelThresholds || []);

  const badgeProfile = {
    level: levelSummary.level,
    levelTitle: levelSummary.levelTitle,
    experiencePoints,
    badgesEarned,
    lastBadgeUnlockedAt: summary?.lastBadgeUnlockedAt || null,
    lastBadgeKey: latestBadge?.badgeKey || null,
    lastEvaluatedAt,
  };

  await UserModel.updateOne(
    { _id: objectId },
    { $set: { badgeProfile } },
  );

  return badgeProfile;
};

const notifyBadgeUnlocks = async (userId, unlockedBadges = []) => {
  await Promise.allSettled(unlockedBadges.map((badge) => (
    NotificationService.createBadgeUnlockedNotification(userId, badge)
      .then(async () => {
        await UserBadgeModel.updateOne(
          { _id: badge._id },
          { $set: { notifiedAt: new Date() } },
        );
      })
  )));
};

export const evaluateUserBadges = async (userId, options = {}) => {
  const { force = false, trigger = 'system' } = options;
  const config = await ensureBadgeConfig();
  await ensureDefaultBadgeDefinitions();

  const { user, metrics } = await getMetricsForUser(userId);
  if (!config.enabled || !user) {
    return {
      success: true,
      data: {
        enabled: Boolean(config.enabled),
        userId,
        metrics,
        newlyUnlocked: [],
        badgeProfile: user?.badgeProfile || buildLevelSummary(0, config.levelThresholds || []),
      },
    };
  }

  const cooldownMs = Math.max(1, toNumber(config.evaluationCooldownMinutes || DEFAULT_CONFIG.evaluationCooldownMinutes)) * 60000;
  const lastEvaluatedAt = user.badgeProfile?.lastEvaluatedAt ? new Date(user.badgeProfile.lastEvaluatedAt) : null;
  const shouldAward = force || !lastEvaluatedAt || (Date.now() - lastEvaluatedAt.getTime()) >= cooldownMs;

  let newlyUnlocked = [];
  if (shouldAward) {
    const definitions = await BadgeDefinitionModel.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    const earnedBadges = await UserBadgeModel.find({ user: user._id })
      .select('badgeKey badge')
      .lean();
    const earnedBadgeKeys = new Set(earnedBadges.map((badge) => badge.badgeKey));

    for (const definition of definitions) {
      if (!isBadgeApplicableToRole(definition, user.role) || earnedBadgeKeys.has(definition.key)) {
        continue;
      }

      const currentValue = roundMetric(metrics[definition.criteria.metric]);
      const targetValue = roundMetric(definition.criteria.targetValue);
      if (currentValue < targetValue) {
        continue;
      }

      try {
        const createdBadge = await UserBadgeModel.create({
          user: user._id,
          badge: definition._id,
          badgeKey: definition.key,
          titleSnapshot: definition.title,
          descriptionSnapshot: definition.description,
          shortDescriptionSnapshot: definition.shortDescription || '',
          iconSnapshot: definition.icon || 'military_tech',
          accentColorSnapshot: definition.accentColor || '#7c3aed',
          categorySnapshot: definition.category || 'engagement',
          rewardSnapshot: {
            experiencePoints: toNumber(definition.reward?.experiencePoints),
            label: definition.reward?.label || '',
          },
          criteriaSnapshot: {
            metric: definition.criteria.metric,
            comparison: definition.criteria.comparison || 'gte',
            targetValue,
          },
          metricValueAtUnlock: currentValue,
          progressPercentAtUnlock: 100,
          sourceEvent: trigger,
        });

        newlyUnlocked.push(createdBadge.toObject());
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }
      }
    }
  }

  const badgeProfile = await buildBadgeProfileSnapshot(user._id, config, new Date());

  if (newlyUnlocked.length) {
    await notifyBadgeUnlocks(user._id, newlyUnlocked);
  }

  return {
    success: true,
    data: {
      enabled: true,
      userId,
      metrics,
      newlyUnlocked: newlyUnlocked.map(formatUserBadge),
      badgeProfile: {
        ...buildLevelSummary(badgeProfile.experiencePoints, config.levelThresholds || []),
        badgesEarned: badgeProfile.badgesEarned,
        lastBadgeUnlockedAt: badgeProfile.lastBadgeUnlockedAt,
        lastBadgeKey: badgeProfile.lastBadgeKey,
        lastEvaluatedAt: badgeProfile.lastEvaluatedAt,
      },
    },
  };
};

export const getUserBadgeOverview = async (viewerUserId, targetUserId) => {
  const config = await ensureBadgeConfig();
  await ensureDefaultBadgeDefinitions();

  const evaluation = await evaluateUserBadges(targetUserId, {
    force: false,
    trigger: 'badge_overview',
  });

  const [{ user, metrics }, badgeDefinitions, earnedBadges] = await Promise.all([
    getMetricsForUser(targetUserId),
    BadgeDefinitionModel.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean(),
    UserBadgeModel.find({ user: targetUserId }).sort({ unlockedAt: -1, createdAt: -1 }).lean(),
  ]);

  const earnedBadgeKeys = new Set(earnedBadges.map((badge) => badge.badgeKey));
  const isOwner = viewerUserId?.toString?.() === targetUserId?.toString?.();
  const badgeProfile = {
    ...buildLevelSummary(user.badgeProfile?.experiencePoints || 0, config.levelThresholds || []),
    badgesEarned: toNumber(user.badgeProfile?.badgesEarned),
    lastBadgeUnlockedAt: user.badgeProfile?.lastBadgeUnlockedAt || null,
    lastBadgeKey: user.badgeProfile?.lastBadgeKey || null,
    lastEvaluatedAt: user.badgeProfile?.lastEvaluatedAt || null,
  };

  return {
    success: true,
    data: {
      enabled: Boolean(config.enabled),
      feedRefreshMinutes: toNumber(config.feedRefreshMinutes || DEFAULT_CONFIG.feedRefreshMinutes),
      celebrationWindowHours: toNumber(config.celebrationWindowHours || DEFAULT_CONFIG.celebrationWindowHours),
      user: {
        _id: user._id?.toString?.() || targetUserId,
        displayName: user.displayName,
        avatar: user.avatar || 'img/avatar.png',
        role: user.role,
      },
      isOwner,
      badgeProfile,
      earnedBadges: earnedBadges.map(formatUserBadge),
      featuredBadges: earnedBadges.slice(0, 3).map(formatUserBadge),
      nextBadges: isOwner ? computeNextBadges(badgeDefinitions, earnedBadgeKeys, metrics, user.role, 3) : [],
      recentUnlocks: earnedBadges.slice(0, 5).map(formatUserBadge),
      metrics: isOwner ? metrics : undefined,
      recentlyUnlocked: evaluation.data.newlyUnlocked || [],
    },
  };
};

export const getMyBadgeFeed = async (userId, query = {}) => {
  const config = await ensureBadgeConfig();
  const limit = Math.max(3, Math.min(12, Number(query.limit || 6)));
  const overview = await getUserBadgeOverview(userId, userId);

  return {
    success: true,
    data: {
      enabled: Boolean(config.enabled),
      feedRefreshMinutes: toNumber(config.feedRefreshMinutes || DEFAULT_CONFIG.feedRefreshMinutes),
      celebrationWindowHours: toNumber(config.celebrationWindowHours || DEFAULT_CONFIG.celebrationWindowHours),
      badgeProfile: overview.data.badgeProfile,
      recentUnlocks: overview.data.recentUnlocks.slice(0, limit),
      nextBadges: overview.data.nextBadges.slice(0, 3),
      recentlyUnlocked: overview.data.recentlyUnlocked || [],
    },
  };
};

export const getAdminBadgeConfig = async () => {
  const config = await ensureBadgeConfig();
  await ensureDefaultBadgeDefinitions();

  const definitions = await BadgeDefinitionModel.find()
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  return {
    success: true,
    data: {
      config: {
        enabled: Boolean(config.enabled),
        feedRefreshMinutes: toNumber(config.feedRefreshMinutes || DEFAULT_CONFIG.feedRefreshMinutes),
        evaluationCooldownMinutes: toNumber(config.evaluationCooldownMinutes || DEFAULT_CONFIG.evaluationCooldownMinutes),
        celebrationWindowHours: toNumber(config.celebrationWindowHours || DEFAULT_CONFIG.celebrationWindowHours),
        levelThresholds: normalizeLevelThresholds(config.levelThresholds || []),
        updatedAt: config.updatedAt || null,
        updatedBy: config.updatedBy || null,
      },
      definitions: definitions.map(formatBadgeDefinition),
      metricCatalog: BADGE_METRIC_CATALOG,
      categories: BADGE_CATEGORIES,
      roles: BADGE_ROLES,
    },
  };
};

export const updateAdminBadgeConfig = async (adminId, payload = {}) => {
  const config = await ensureBadgeConfig();

  if (typeof payload.enabled === 'boolean') {
    config.enabled = payload.enabled;
  }

  if (Number.isFinite(Number(payload.feedRefreshMinutes))) {
    config.feedRefreshMinutes = Math.max(1, Math.min(1440, Number(payload.feedRefreshMinutes)));
  }

  if (Number.isFinite(Number(payload.evaluationCooldownMinutes))) {
    config.evaluationCooldownMinutes = Math.max(1, Math.min(1440, Number(payload.evaluationCooldownMinutes)));
  }

  if (Number.isFinite(Number(payload.celebrationWindowHours))) {
    config.celebrationWindowHours = Math.max(1, Math.min(720, Number(payload.celebrationWindowHours)));
  }

  if (Array.isArray(payload.levelThresholds) && payload.levelThresholds.length) {
    config.levelThresholds = normalizeLevelThresholds(payload.levelThresholds);
  }

  config.updatedBy = adminId || null;
  await config.save();

  return getAdminBadgeConfig();
};

export const createBadgeDefinition = async (adminId, payload = {}) => {
  await ensureDefaultBadgeDefinitions();
  const normalizedPayload = normalizeDefinitionPayload(payload);

  if (!normalizedPayload.title) {
    throw new Error('Badge title is required.');
  }

  if (!normalizedPayload.description) {
    throw new Error('Badge description is required.');
  }

  const existing = await BadgeDefinitionModel.findOne({ key: normalizedPayload.key }).select('_id').lean();
  if (existing) {
    throw new Error('A badge with this key already exists.');
  }

  const definition = await BadgeDefinitionModel.create({
    ...normalizedPayload,
    createdBy: adminId || null,
    updatedBy: adminId || null,
  });

  return {
    success: true,
    message: 'Badge created successfully.',
    data: formatBadgeDefinition(definition.toObject()),
  };
};

export const updateBadgeDefinition = async (adminId, badgeId, payload = {}) => {
  const definition = await BadgeDefinitionModel.findById(badgeId);
  if (!definition) {
    const error = new Error('Badge definition not found.');
    error.status = 404;
    throw error;
  }

  const normalizedPayload = normalizeDefinitionPayload(payload);
  if (normalizedPayload.key !== definition.key) {
    const existing = await BadgeDefinitionModel.findOne({ key: normalizedPayload.key, _id: { $ne: definition._id } })
      .select('_id')
      .lean();
    if (existing) {
      throw new Error('Another badge already uses this key.');
    }
  }

  Object.assign(definition, normalizedPayload, { updatedBy: adminId || null });
  await definition.save();

  return {
    success: true,
    message: 'Badge updated successfully.',
    data: formatBadgeDefinition(definition.toObject()),
  };
};

export const deleteBadgeDefinition = async (adminId, badgeId) => {
  const definition = await BadgeDefinitionModel.findById(badgeId);
  if (!definition) {
    const error = new Error('Badge definition not found.');
    error.status = 404;
    throw error;
  }

  const hasAwards = await UserBadgeModel.exists({ badge: definition._id });
  if (hasAwards) {
    definition.isActive = false;
    definition.updatedBy = adminId || null;
    await definition.save();

    return {
      success: true,
      message: 'Badge has existing awards, so it was deactivated instead of deleted.',
      data: formatBadgeDefinition(definition.toObject()),
    };
  }

  await definition.deleteOne();
  return {
    success: true,
    message: 'Badge deleted successfully.',
  };
};
