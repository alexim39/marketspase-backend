import mongoose from 'mongoose';
import { UserBadgeModel } from '../../badges/models/index.js';
import { NotificationService } from '../../notification/services/notification.service.js';
import { UserModel } from '../../user/models/user/index.js';
import {
  DEFAULT_GAMIFICATION_LEVEL_THRESHOLDS,
  GAMIFICATION_ACTION_CATALOG,
  GAMIFICATION_CATEGORIES,
  GAMIFICATION_ROLES,
  GamificationConfigModel,
  GamificationEventModel,
  UserGamificationMilestoneModel,
} from '../models/index.js';

const DEFAULT_CONFIG = {
  enabled: true,
  refreshIntervalMinutes: 15,
  celebrationWindowHours: 72,
};

const toNumber = (value) => Number(value || 0);
const roundMetric = (value) => Math.round(toNumber(value) * 100) / 100;
const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value)));
const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const normalizeRoles = (roles) => {
  const values = Array.isArray(roles) ? roles : [roles || 'all'];
  const normalized = [...new Set(values
    .map((value) => String(value || '').trim())
    .filter((value) => GAMIFICATION_ROLES.includes(value)))];
  return normalized.length ? normalized : ['all'];
};

const normalizeActionKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const normalizeLevelThresholds = (thresholds = []) => {
  const source = Array.isArray(thresholds) && thresholds.length
    ? thresholds
    : DEFAULT_GAMIFICATION_LEVEL_THRESHOLDS;

  const sorted = [...source]
    .map((threshold, index) => ({
      level: Math.max(1, Number(threshold.level || index + 1)),
      title: String(threshold.title || `Level ${index + 1}`).trim() || `Level ${index + 1}`,
      minExperiencePoints: Math.max(0, Number(threshold.minExperiencePoints || 0)),
      description: String(threshold.description || '').trim(),
      rewardLabel: String(threshold.rewardLabel || '').trim(),
      linkedBadgeKey: threshold.linkedBadgeKey ? String(threshold.linkedBadgeKey).trim() : null,
      featureKey: threshold.featureKey ? String(threshold.featureKey).trim() : null,
      icon: String(threshold.icon || 'military_tech').trim() || 'military_tech',
      accentColor: String(threshold.accentColor || '#7c3aed').trim() || '#7c3aed',
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
      ...DEFAULT_GAMIFICATION_LEVEL_THRESHOLDS[0],
      minExperiencePoints: 0,
      level: 1,
    });
  }

  return deduped.map((threshold, index) => ({
    level: index + 1,
    title: threshold.title,
    minExperiencePoints: index === 0
      ? 0
      : Math.max(threshold.minExperiencePoints, deduped[index - 1].minExperiencePoints + 1),
    description: threshold.description,
    rewardLabel: threshold.rewardLabel,
    linkedBadgeKey: threshold.linkedBadgeKey,
    featureKey: threshold.featureKey,
    icon: threshold.icon,
    accentColor: threshold.accentColor,
  }));
};

const buildDefaultActionRules = () => GAMIFICATION_ACTION_CATALOG.map((action, index) => ({
  actionKey: action.actionKey,
  label: action.label,
  description: action.description,
  category: action.category,
  roles: [...action.roles],
  icon: action.icon,
  accentColor: action.accentColor,
  experiencePoints: action.defaultExperiencePoints,
  useMetadataExperiencePoints: Boolean(action.useMetadataExperiencePoints),
  metadataExperiencePointsField: action.metadataExperiencePointsField || null,
  multiplier: Number(action.multiplier || 1),
  maxExperiencePointsPerEvent: null,
  isActive: true,
  sortOrder: index * 10,
}));

const normalizeActionRules = (rules = []) => {
  const defaults = buildDefaultActionRules();
  const defaultMap = new Map(defaults.map((rule) => [rule.actionKey, rule]));
  const merged = new Map();

  for (const rule of defaults) {
    merged.set(rule.actionKey, rule);
  }

  for (const candidate of Array.isArray(rules) ? rules : []) {
    const actionKey = normalizeActionKey(candidate.actionKey);
    if (!actionKey) {
      continue;
    }

    const fallback = defaultMap.get(actionKey) || {
      actionKey,
      label: actionKey.replace(/_/g, ' '),
      description: '',
      category: 'engagement',
      roles: ['all'],
      icon: 'stars',
      accentColor: '#7c3aed',
      experiencePoints: 0,
      useMetadataExperiencePoints: false,
      metadataExperiencePointsField: null,
      multiplier: 1,
      maxExperiencePointsPerEvent: null,
      isActive: true,
      sortOrder: merged.size * 10,
    };

    merged.set(actionKey, {
      actionKey,
      label: String(candidate.label || fallback.label).trim() || fallback.label,
      description: String(candidate.description || fallback.description || '').trim(),
      category: GAMIFICATION_CATEGORIES.includes(String(candidate.category || '').trim())
        ? String(candidate.category).trim()
        : fallback.category,
      roles: normalizeRoles(candidate.roles || fallback.roles),
      icon: String(candidate.icon || fallback.icon).trim() || fallback.icon,
      accentColor: String(candidate.accentColor || fallback.accentColor).trim() || fallback.accentColor,
      experiencePoints: Math.max(0, Number(candidate.experiencePoints ?? fallback.experiencePoints ?? 0)),
      useMetadataExperiencePoints: typeof candidate.useMetadataExperiencePoints === 'boolean'
        ? candidate.useMetadataExperiencePoints
        : Boolean(fallback.useMetadataExperiencePoints),
      metadataExperiencePointsField: candidate.metadataExperiencePointsField
        ? String(candidate.metadataExperiencePointsField).trim()
        : fallback.metadataExperiencePointsField || null,
      multiplier: Math.max(0, Number(candidate.multiplier ?? fallback.multiplier ?? 1)),
      maxExperiencePointsPerEvent: Number.isFinite(Number(candidate.maxExperiencePointsPerEvent))
        ? Math.max(0, Number(candidate.maxExperiencePointsPerEvent))
        : fallback.maxExperiencePointsPerEvent ?? null,
      isActive: candidate.isActive !== false,
      sortOrder: Math.max(0, Number(candidate.sortOrder ?? fallback.sortOrder ?? 0)),
    });
  }

  return [...merged.values()].sort((left, right) => (
    left.sortOrder - right.sortOrder ||
    left.label.localeCompare(right.label)
  ));
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

  return { current, next, normalizedThresholds };
};

const buildLevelSummary = (experiencePoints, thresholds) => {
  const { current, next, normalizedThresholds } = findCurrentLevel(experiencePoints, thresholds);
  const currentMin = current?.minExperiencePoints || 0;
  const nextMin = next?.minExperiencePoints || currentMin;
  const progressPercent = next
    ? clampPercent(((experiencePoints - currentMin) / Math.max(1, nextMin - currentMin)) * 100)
    : 100;

  return {
    currentLevel: current?.level || 1,
    currentLevelTitle: current?.title || 'Starter',
    currentLevelMinExperiencePoints: currentMin,
    totalExperiencePoints: roundMetric(experiencePoints),
    nextLevel: next?.level || null,
    nextLevelTitle: next?.title || null,
    nextLevelMinExperiencePoints: next?.minExperiencePoints || null,
    experiencePointsToNextLevel: next ? Math.max(0, roundMetric(nextMin - experiencePoints)) : 0,
    progressPercent,
    thresholds: normalizedThresholds,
  };
};

const isRuleApplicableToRole = (rule, role) => {
  const roles = normalizeRoles(rule.roles);
  return roles.includes('all') || roles.includes(role);
};

const formatLevelThreshold = (threshold, currentExperiencePoints = 0) => ({
  level: threshold.level,
  title: threshold.title,
  minExperiencePoints: toNumber(threshold.minExperiencePoints),
  description: threshold.description || '',
  rewardLabel: threshold.rewardLabel || '',
  linkedBadgeKey: threshold.linkedBadgeKey || null,
  featureKey: threshold.featureKey || null,
  icon: threshold.icon || 'military_tech',
  accentColor: threshold.accentColor || '#7c3aed',
  experiencePointsRemaining: Math.max(0, roundMetric(threshold.minExperiencePoints - currentExperiencePoints)),
  progressPercent: clampPercent((currentExperiencePoints / Math.max(1, threshold.minExperiencePoints || 1)) * 100),
});

const formatActionRule = (rule) => ({
  actionKey: rule.actionKey,
  label: rule.label,
  description: rule.description || '',
  category: rule.category || 'engagement',
  roles: normalizeRoles(rule.roles),
  icon: rule.icon || 'stars',
  accentColor: rule.accentColor || '#7c3aed',
  experiencePoints: Math.max(0, toNumber(rule.experiencePoints)),
  useMetadataExperiencePoints: Boolean(rule.useMetadataExperiencePoints),
  metadataExperiencePointsField: rule.metadataExperiencePointsField || null,
  multiplier: Math.max(0, toNumber(rule.multiplier || 1)),
  maxExperiencePointsPerEvent: Number.isFinite(Number(rule.maxExperiencePointsPerEvent))
    ? Math.max(0, Number(rule.maxExperiencePointsPerEvent))
    : null,
  isActive: rule.isActive !== false,
  sortOrder: Math.max(0, toNumber(rule.sortOrder)),
});

const formatEvent = (event) => ({
  id: event._id?.toString?.() || event.id,
  actionKey: event.actionKey,
  category: event.category || 'engagement',
  label: event.labelSnapshot,
  description: event.descriptionSnapshot || '',
  sourceKey: event.sourceKey,
  sourceType: event.sourceType || 'system',
  sourceId: event.sourceId || null,
  experiencePointsAwarded: roundMetric(event.experiencePointsAwarded),
  awardedAt: event.awardedAt || event.createdAt || null,
  occurredAt: event.occurredAt || event.awardedAt || event.createdAt || null,
  metadata: event.metadata || {},
});

const formatMilestone = (milestone) => ({
  id: milestone._id?.toString?.() || milestone.id,
  milestoneKey: milestone.milestoneKey,
  title: milestone.titleSnapshot,
  description: milestone.descriptionSnapshot || '',
  rewardLabel: milestone.rewardLabelSnapshot || '',
  linkedBadgeKey: milestone.linkedBadgeKeySnapshot || null,
  featureKey: milestone.featureKeySnapshot || null,
  icon: milestone.iconSnapshot || 'military_tech',
  accentColor: milestone.accentColorSnapshot || '#7c3aed',
  minLevel: toNumber(milestone.minLevel),
  sourceLevel: toNumber(milestone.sourceLevel),
  unlockedAt: milestone.unlockedAt || milestone.createdAt || null,
  notifiedAt: milestone.notifiedAt || null,
});

const ensureGamificationConfig = async () => {
  const existing = await GamificationConfigModel.findOne({ key: 'default' });
  if (existing) {
    let shouldSave = false;

    const normalizedActionRules = normalizeActionRules(existing.actionRules || []);
    if (JSON.stringify(normalizedActionRules) !== JSON.stringify(existing.actionRules || [])) {
      existing.actionRules = normalizedActionRules;
      shouldSave = true;
    }

    const normalizedLevels = normalizeLevelThresholds(existing.levelThresholds || []);
    if (JSON.stringify(normalizedLevels) !== JSON.stringify(existing.levelThresholds || [])) {
      existing.levelThresholds = normalizedLevels;
      shouldSave = true;
    }

    if (!Number.isFinite(Number(existing.refreshIntervalMinutes))) {
      existing.refreshIntervalMinutes = DEFAULT_CONFIG.refreshIntervalMinutes;
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

  return GamificationConfigModel.create({
    key: 'default',
    ...DEFAULT_CONFIG,
    actionRules: buildDefaultActionRules(),
    levelThresholds: normalizeLevelThresholds(DEFAULT_GAMIFICATION_LEVEL_THRESHOLDS),
  });
};

const calculateExperiencePointsAward = (rule, metadata = {}) => {
  const baseExperiencePoints = Math.max(0, toNumber(rule.experiencePoints || 0));
  const metadataField = rule.metadataExperiencePointsField || 'experiencePoints';
  const metadataExperiencePoints = rule.useMetadataExperiencePoints
    ? Math.max(0, toNumber(metadata?.[metadataField]))
    : 0;
  const multiplier = Math.max(0, toNumber(rule.multiplier || 1));

  let award = roundMetric((baseExperiencePoints + metadataExperiencePoints) * multiplier);
  if (Number.isFinite(Number(rule.maxExperiencePointsPerEvent))) {
    award = Math.min(award, Math.max(0, Number(rule.maxExperiencePointsPerEvent)));
  }

  return Math.max(0, award);
};

const buildMilestoneKey = (threshold) => `level-${threshold.level}`;

const buildMilestonePayload = (threshold, sourceLevel) => ({
  milestoneKey: buildMilestoneKey(threshold),
  titleSnapshot: threshold.title,
  descriptionSnapshot: threshold.description || '',
  rewardLabelSnapshot: threshold.rewardLabel || '',
  linkedBadgeKeySnapshot: threshold.linkedBadgeKey || null,
  featureKeySnapshot: threshold.featureKey || null,
  iconSnapshot: threshold.icon || 'military_tech',
  accentColorSnapshot: threshold.accentColor || '#7c3aed',
  minLevel: threshold.level,
  sourceLevel,
  unlockedAt: new Date(),
});

const buildCelebrationFeed = ({
  profile,
  recentMilestones,
  recentBadges,
  celebrationWindowHours,
}) => {
  const cutoff = new Date(Date.now() - (Math.max(1, celebrationWindowHours) * 3600000));
  const celebrations = [];

  if (profile?.recentLevelUpAt && new Date(profile.recentLevelUpAt) >= cutoff) {
    celebrations.push({
      type: 'level_up',
      key: `level:${profile.currentLevel}`,
      title: `Level ${profile.currentLevel} unlocked`,
      description: `You just reached ${profile.currentLevelTitle}. Keep the momentum going.`,
      icon: 'trending_up',
      accentColor: '#2563eb',
      happenedAt: profile.recentLevelUpAt,
      rewardLabel: profile.nextLevel ? `${profile.experiencePointsToNextLevel} XP to level ${profile.nextLevel}` : 'You are at the current top configured level.',
      level: profile.currentLevel,
    });
  }

  for (const milestone of recentMilestones.filter((entry) => new Date(entry.unlockedAt) >= cutoff)) {
    celebrations.push({
      type: 'milestone',
      key: milestone.milestoneKey,
      title: milestone.title,
      description: milestone.description || `You unlocked a new milestone at level ${milestone.minLevel}.`,
      icon: milestone.icon || 'emoji_events',
      accentColor: milestone.accentColor || '#7c3aed',
      happenedAt: milestone.unlockedAt,
      rewardLabel: milestone.rewardLabel || '',
      level: milestone.minLevel,
    });
  }

  for (const badge of recentBadges.filter((entry) => new Date(entry.unlockedAt) >= cutoff)) {
    celebrations.push({
      type: 'badge',
      key: badge.badgeKey,
      title: badge.titleSnapshot,
      description: badge.descriptionSnapshot || 'You unlocked a badge milestone.',
      icon: badge.iconSnapshot || 'workspace_premium',
      accentColor: badge.accentColorSnapshot || '#7c3aed',
      happenedAt: badge.unlockedAt,
      rewardLabel: badge.rewardSnapshot?.label || '',
      badgeKey: badge.badgeKey,
    });
  }

  return celebrations.sort((left, right) => (
    new Date(right.happenedAt).getTime() - new Date(left.happenedAt).getTime()
  ));
};

const buildProfileSnapshot = async ({
  user,
  config,
  lastActionKey = null,
  lastExperiencePointsAwarded = null,
  lastEventAt = null,
}) => {
  const objectId = toObjectId(user._id);
  const [eventSummary, milestoneCount] = await Promise.all([
    GamificationEventModel.aggregate([
      { $match: { user: objectId } },
      {
        $group: {
          _id: null,
          totalExperiencePoints: { $sum: '$experiencePointsAwarded' },
          totalEvents: { $sum: 1 },
          lastEventAt: { $max: '$awardedAt' },
        },
      },
    ]),
    UserGamificationMilestoneModel.countDocuments({ user: objectId }),
  ]);

  const totalExperiencePoints = roundMetric(eventSummary[0]?.totalExperiencePoints || 0);
  const levelSummary = buildLevelSummary(totalExperiencePoints, config.levelThresholds || []);
  const previousProfile = user.gamificationProfile || {};

  const profile = {
    totalExperiencePoints,
    currentLevel: levelSummary.currentLevel,
    currentLevelTitle: levelSummary.currentLevelTitle,
    currentLevelMinExperiencePoints: levelSummary.currentLevelMinExperiencePoints,
    nextLevel: levelSummary.nextLevel,
    nextLevelTitle: levelSummary.nextLevelTitle,
    nextLevelMinExperiencePoints: levelSummary.nextLevelMinExperiencePoints,
    experiencePointsToNextLevel: levelSummary.experiencePointsToNextLevel,
    progressPercent: levelSummary.progressPercent,
    totalEvents: toNumber(eventSummary[0]?.totalEvents || 0),
    milestonesUnlocked: toNumber(milestoneCount),
    badgesUnlocked: toNumber(user.badgeProfile?.badgesEarned || 0),
    lastActionKey: lastActionKey || previousProfile.lastActionKey || null,
    lastExperiencePointsAwarded: lastExperiencePointsAwarded ?? previousProfile.lastExperiencePointsAwarded ?? 0,
    lastEventAt: lastEventAt || eventSummary[0]?.lastEventAt || previousProfile.lastEventAt || null,
    recentLevelUpAt: previousProfile.recentLevelUpAt || null,
    highestLevelReachedAt: previousProfile.highestLevelReachedAt || null,
    lastMilestoneKey: previousProfile.lastMilestoneKey || null,
    lastMilestoneUnlockedAt: previousProfile.lastMilestoneUnlockedAt || null,
    lastCalculatedAt: new Date(),
  };

  return profile;
};

const unlockLevelMilestones = async ({ userId, previousLevel, nextLevel, thresholds }) => {
  if (nextLevel <= previousLevel) {
    return [];
  }

  const unlocked = [];
  for (const threshold of thresholds) {
    if (threshold.level <= previousLevel || threshold.level > nextLevel) {
      continue;
    }

    try {
      const milestone = await UserGamificationMilestoneModel.create({
        user: userId,
        ...buildMilestonePayload(threshold, nextLevel),
      });
      unlocked.push(milestone.toObject());
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }

  return unlocked;
};

const updateUserGamificationProfile = async (userId, profile) => {
  await UserModel.updateOne(
    { _id: userId },
    { $set: { gamificationProfile: profile } },
  );
};

const notifyMilestoneUnlocks = async (userId, milestones = []) => {
  await Promise.allSettled(milestones.map((milestone) => (
    NotificationService.createGamificationMilestoneNotification(userId, milestone)
      .then(async () => {
        await UserGamificationMilestoneModel.updateOne(
          { _id: milestone._id },
          { $set: { notifiedAt: new Date() } },
        );
      })
  )));
};

const buildActionRuleLookup = (config) => {
  const normalizedRules = normalizeActionRules(config.actionRules || []);
  return new Map(normalizedRules.map((rule) => [rule.actionKey, rule]));
};

const loadUserWithGamification = async (userId) => UserModel.findById(userId)
  .select('displayName avatar role loginStreak badgeProfile gamificationProfile')
  .lean();

export const getGamificationSummarySnapshot = async (userId) => {
  const config = await ensureGamificationConfig();
  const user = await loadUserWithGamification(userId);

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const levelSummary = buildLevelSummary(
    user.gamificationProfile?.totalExperiencePoints || 0,
    config.levelThresholds || [],
  );

  return {
    totalExperiencePoints: roundMetric(user.gamificationProfile?.totalExperiencePoints || 0),
    currentLevel: levelSummary.currentLevel,
    currentLevelTitle: levelSummary.currentLevelTitle,
    currentLevelMinExperiencePoints: levelSummary.currentLevelMinExperiencePoints,
    nextLevel: levelSummary.nextLevel,
    nextLevelTitle: levelSummary.nextLevelTitle,
    nextLevelMinExperiencePoints: levelSummary.nextLevelMinExperiencePoints,
    experiencePointsToNextLevel: levelSummary.experiencePointsToNextLevel,
    progressPercent: levelSummary.progressPercent,
    totalEvents: toNumber(user.gamificationProfile?.totalEvents || 0),
    milestonesUnlocked: toNumber(user.gamificationProfile?.milestonesUnlocked || 0),
    badgesUnlocked: toNumber(user.gamificationProfile?.badgesUnlocked || user.badgeProfile?.badgesEarned || 0),
    lastActionKey: user.gamificationProfile?.lastActionKey || null,
    lastExperiencePointsAwarded: toNumber(user.gamificationProfile?.lastExperiencePointsAwarded || 0),
    lastEventAt: user.gamificationProfile?.lastEventAt || null,
    recentLevelUpAt: user.gamificationProfile?.recentLevelUpAt || null,
    highestLevelReachedAt: user.gamificationProfile?.highestLevelReachedAt || null,
    lastMilestoneKey: user.gamificationProfile?.lastMilestoneKey || null,
    lastMilestoneUnlockedAt: user.gamificationProfile?.lastMilestoneUnlockedAt || null,
    lastCalculatedAt: user.gamificationProfile?.lastCalculatedAt || null,
  };
};

export const awardGamificationProgress = async (payload = {}) => {
  const {
    userId,
    actionKey,
    sourceKey,
    sourceType = 'system',
    sourceId = null,
    metadata = {},
    occurredAt = new Date(),
  } = payload;

  if (!userId) {
    throw new Error('A userId is required to award gamification progress.');
  }

  const normalizedActionKey = normalizeActionKey(actionKey);
  if (!normalizedActionKey) {
    throw new Error('A valid actionKey is required to award gamification progress.');
  }

  const resolvedSourceKey = String(sourceKey || `${normalizedActionKey}:${new Date(occurredAt).toISOString()}`).trim();
  const config = await ensureGamificationConfig();
  const user = await UserModel.findById(userId)
    .select('displayName avatar role badgeProfile gamificationProfile')
    .lean();

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (!config.enabled || !['marketer', 'promoter'].includes(user.role)) {
    return {
      success: true,
      data: {
        skipped: true,
        reason: 'Gamification is disabled for this user.',
        profile: await getGamificationSummarySnapshot(userId),
      },
    };
  }

  const rule = buildActionRuleLookup(config).get(normalizedActionKey);
  if (!rule || !rule.isActive || !isRuleApplicableToRole(rule, user.role)) {
    return {
      success: true,
      data: {
        skipped: true,
        reason: 'This gamification action is not active for the current user role.',
        profile: await getGamificationSummarySnapshot(userId),
      },
    };
  }

  const experiencePointsAwarded = calculateExperiencePointsAward(rule, metadata);
  const previousProfile = user.gamificationProfile || {};
  const previousLevel = Number(previousProfile.currentLevel || 1);
  const awardedAt = new Date();

  try {
    await GamificationEventModel.create({
      user: userId,
      actionKey: normalizedActionKey,
      category: rule.category || 'engagement',
      sourceKey: resolvedSourceKey,
      sourceType,
      sourceId: sourceId ? String(sourceId) : null,
      labelSnapshot: rule.label,
      descriptionSnapshot: rule.description || '',
      experiencePointsAwarded,
      metadata,
      occurredAt,
      awardedAt,
      profileSnapshot: {
        totalExperiencePoints: roundMetric(previousProfile.totalExperiencePoints || 0),
        currentLevel: previousLevel,
        currentLevelTitle: previousProfile.currentLevelTitle || 'Starter',
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return {
        success: true,
        data: {
          skipped: true,
          duplicate: true,
          reason: 'This gamification event has already been recorded.',
          profile: await getGamificationSummarySnapshot(userId),
        },
      };
    }
    throw error;
  }

  const profile = await buildProfileSnapshot({
    user,
    config,
    lastActionKey: normalizedActionKey,
    lastExperiencePointsAwarded: experiencePointsAwarded,
    lastEventAt: awardedAt,
  });

  const leveledUp = profile.currentLevel > previousLevel;
  if (leveledUp) {
    profile.recentLevelUpAt = awardedAt;
    profile.highestLevelReachedAt = awardedAt;
  } else if (
    profile.currentLevel >= Number(previousProfile.currentLevel || 1) &&
    previousProfile.highestLevelReachedAt
  ) {
    profile.highestLevelReachedAt = previousProfile.highestLevelReachedAt;
  }

  const thresholds = normalizeLevelThresholds(config.levelThresholds || []);
  const newlyUnlockedMilestones = await unlockLevelMilestones({
    userId,
    previousLevel,
    nextLevel: profile.currentLevel,
    thresholds,
  });

  if (newlyUnlockedMilestones.length) {
    const latestMilestone = newlyUnlockedMilestones[newlyUnlockedMilestones.length - 1];
    profile.milestonesUnlocked = toNumber(profile.milestonesUnlocked || 0) + newlyUnlockedMilestones.length;
    profile.lastMilestoneKey = latestMilestone.milestoneKey;
    profile.lastMilestoneUnlockedAt = latestMilestone.unlockedAt;
  }

  await updateUserGamificationProfile(userId, profile);

  await GamificationEventModel.updateOne(
    { user: userId, actionKey: normalizedActionKey, sourceKey: resolvedSourceKey },
    {
      $set: {
        profileSnapshot: {
          totalExperiencePoints: profile.totalExperiencePoints,
          currentLevel: profile.currentLevel,
          currentLevelTitle: profile.currentLevelTitle,
        },
      },
    },
  );

  if (leveledUp) {
    await NotificationService.createLevelUpNotification(userId, profile).catch((error) => {
      console.error('Level-up notification failed:', error);
    });
  }

  if (newlyUnlockedMilestones.length) {
    await notifyMilestoneUnlocks(userId, newlyUnlockedMilestones).catch((error) => {
      console.error('Milestone unlock notification failed:', error);
    });
  }

  return {
    success: true,
    data: {
      skipped: false,
      actionKey: normalizedActionKey,
      experiencePointsAwarded,
      leveledUp,
      profile: {
        ...profile,
      },
      newlyUnlockedMilestones: newlyUnlockedMilestones.map(formatMilestone),
    },
  };
};

export const getGamificationDashboard = async (userId) => {
  const config = await ensureGamificationConfig();
  const user = await loadUserWithGamification(userId);

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const profile = await getGamificationSummarySnapshot(userId);
  const objectId = toObjectId(userId);
  const thresholds = normalizeLevelThresholds(config.levelThresholds || []);
  const currentExperiencePoints = profile.totalExperiencePoints;

  const [recentEvents, recentMilestones, recentBadges, actionBreakdown] = await Promise.all([
    GamificationEventModel.find({ user: objectId })
      .sort({ awardedAt: -1, createdAt: -1 })
      .limit(8)
      .lean(),
    UserGamificationMilestoneModel.find({ user: objectId })
      .sort({ unlockedAt: -1, createdAt: -1 })
      .limit(6)
      .lean(),
    UserBadgeModel.find({ user: objectId })
      .sort({ unlockedAt: -1, createdAt: -1 })
      .limit(4)
      .lean(),
    GamificationEventModel.aggregate([
      { $match: { user: objectId } },
      {
        $group: {
          _id: '$actionKey',
          totalCount: { $sum: 1 },
          totalExperiencePoints: { $sum: '$experiencePointsAwarded' },
          lastAwardedAt: { $max: '$awardedAt' },
        },
      },
      { $sort: { totalExperiencePoints: -1, totalCount: -1 } },
      { $limit: 6 },
    ]),
  ]);

  const actionRuleLookup = buildActionRuleLookup(config);
  const upcomingMilestones = thresholds
    .filter((threshold) => threshold.level > profile.currentLevel)
    .slice(0, 4)
    .map((threshold) => formatLevelThreshold(threshold, currentExperiencePoints));

  const formattedRecentMilestones = recentMilestones.map(formatMilestone);
  const celebrations = buildCelebrationFeed({
    profile,
    recentMilestones: formattedRecentMilestones,
    recentBadges,
    celebrationWindowHours: Number(config.celebrationWindowHours || DEFAULT_CONFIG.celebrationWindowHours),
  });

  return {
    success: true,
    data: {
      enabled: Boolean(config.enabled),
      refreshIntervalMinutes: Math.max(1, Number(config.refreshIntervalMinutes || DEFAULT_CONFIG.refreshIntervalMinutes)),
      celebrationWindowHours: Math.max(1, Number(config.celebrationWindowHours || DEFAULT_CONFIG.celebrationWindowHours)),
      user: {
        _id: user._id?.toString?.() || userId,
        displayName: user.displayName,
        avatar: user.avatar || 'img/avatar.png',
        role: user.role,
      },
      gamificationProfile: profile,
      streakSummary: {
        currentStreak: toNumber(user.loginStreak?.currentStreak || 0),
        longestStreak: toNumber(user.loginStreak?.longestStreak || 0),
        totalPointsEarned: toNumber(user.loginStreak?.totalPointsEarned || 0),
        withdrawablePoints: toNumber(user.loginStreak?.withdrawablePoints || 0),
      },
      badgeSummary: {
        badgesEarned: toNumber(user.badgeProfile?.badgesEarned || 0),
        lastBadgeKey: user.badgeProfile?.lastBadgeKey || null,
        lastBadgeUnlockedAt: user.badgeProfile?.lastBadgeUnlockedAt || null,
      },
      levelThresholds: thresholds.map((threshold) => formatLevelThreshold(threshold, currentExperiencePoints)),
      upcomingMilestones,
      unlockedMilestones: formattedRecentMilestones,
      actionBreakdown: actionBreakdown.map((entry) => {
        const rule = actionRuleLookup.get(entry._id);
        return {
          actionKey: entry._id,
          label: rule?.label || entry._id.replace(/_/g, ' '),
          description: rule?.description || '',
          category: rule?.category || 'engagement',
          icon: rule?.icon || 'stars',
          accentColor: rule?.accentColor || '#7c3aed',
          totalCount: toNumber(entry.totalCount || 0),
          totalExperiencePoints: roundMetric(entry.totalExperiencePoints || 0),
          lastAwardedAt: entry.lastAwardedAt || null,
        };
      }),
      recentEvents: recentEvents.map(formatEvent),
      recentCelebrations: celebrations,
      recentBadges: recentBadges.map((badge) => ({
        key: badge.badgeKey,
        title: badge.titleSnapshot,
        description: badge.descriptionSnapshot || '',
        icon: badge.iconSnapshot || 'workspace_premium',
        accentColor: badge.accentColorSnapshot || '#7c3aed',
        unlockedAt: badge.unlockedAt || badge.createdAt || null,
        rewardLabel: badge.rewardSnapshot?.label || '',
      })),
    },
  };
};

export const getGamificationFeed = async (userId) => {
  const dashboard = await getGamificationDashboard(userId);
  return {
    success: true,
    data: {
      enabled: dashboard.data.enabled,
      refreshIntervalMinutes: dashboard.data.refreshIntervalMinutes,
      celebrationWindowHours: dashboard.data.celebrationWindowHours,
      gamificationProfile: dashboard.data.gamificationProfile,
      streakSummary: dashboard.data.streakSummary,
      badgeSummary: dashboard.data.badgeSummary,
      upcomingMilestones: dashboard.data.upcomingMilestones.slice(0, 2),
      recentCelebrations: dashboard.data.recentCelebrations.slice(0, 4),
    },
  };
};

export const getAdminGamificationConfig = async () => {
  const config = await ensureGamificationConfig();
  return {
    success: true,
    data: {
      config: {
        enabled: Boolean(config.enabled),
        refreshIntervalMinutes: Math.max(1, Number(config.refreshIntervalMinutes || DEFAULT_CONFIG.refreshIntervalMinutes)),
        celebrationWindowHours: Math.max(1, Number(config.celebrationWindowHours || DEFAULT_CONFIG.celebrationWindowHours)),
        actionRules: normalizeActionRules(config.actionRules || []).map(formatActionRule),
        levelThresholds: normalizeLevelThresholds(config.levelThresholds || []).map((threshold) => ({
          level: threshold.level,
          title: threshold.title,
          minExperiencePoints: threshold.minExperiencePoints,
          description: threshold.description || '',
          rewardLabel: threshold.rewardLabel || '',
          linkedBadgeKey: threshold.linkedBadgeKey || null,
          featureKey: threshold.featureKey || null,
          icon: threshold.icon || 'military_tech',
          accentColor: threshold.accentColor || '#7c3aed',
        })),
        updatedAt: config.updatedAt || null,
        updatedBy: config.updatedBy || null,
      },
      actionCatalog: GAMIFICATION_ACTION_CATALOG,
      categories: GAMIFICATION_CATEGORIES,
      roles: GAMIFICATION_ROLES,
    },
  };
};

export const updateAdminGamificationConfig = async (adminId, payload = {}) => {
  const config = await ensureGamificationConfig();

  if (typeof payload.enabled === 'boolean') {
    config.enabled = payload.enabled;
  }

  if (Number.isFinite(Number(payload.refreshIntervalMinutes))) {
    config.refreshIntervalMinutes = Math.max(1, Math.min(1440, Number(payload.refreshIntervalMinutes)));
  }

  if (Number.isFinite(Number(payload.celebrationWindowHours))) {
    config.celebrationWindowHours = Math.max(1, Math.min(720, Number(payload.celebrationWindowHours)));
  }

  if (Array.isArray(payload.actionRules)) {
    config.actionRules = normalizeActionRules(payload.actionRules);
  }

  if (Array.isArray(payload.levelThresholds) && payload.levelThresholds.length) {
    config.levelThresholds = normalizeLevelThresholds(payload.levelThresholds);
  }

  config.updatedBy = adminId || null;
  await config.save();

  return getAdminGamificationConfig();
};
