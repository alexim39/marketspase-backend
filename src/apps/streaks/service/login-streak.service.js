import mongoose from 'mongoose';
import { UserModel } from '../../user/models/user/index.js';
import { TransactionModel } from '../../user/models/transaction/index.js';
import { evaluateUserBadges } from '../../badges/service/badge.service.js';
import { LoginStreakConfigModel } from '../models/login-streak-config.model.js';
import { LeaderboardSnapshotModel } from '../models/leaderboard-snapshot.model.js';
import { LoginStreakSessionModel } from '../models/login-streak-session.model.js';

const DEFAULT_TIMEZONE = 'Africa/Lagos';
const DEFAULT_DAILY_REWARDS = Array.from({ length: 7 }, (_, index) => ({
  day: index + 1,
  points: 1,
}));
const DEFAULT_LEADERBOARD_SETTINGS = {
  enabled: true,
  defaultMetric: 'blended',
  enabledMetrics: ['streak', 'points', 'blended'],
  defaultTimeframe: 'weekly',
  refreshIntervalMinutes: 60,
  topSize: 10,
};
const LEADERBOARD_METRICS = ['streak', 'points', 'blended'];
const LEADERBOARD_TIMEFRAMES = ['daily', 'weekly', 'monthly'];
const LEADERBOARD_WINDOW_DAYS = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};
const MAX_HEARTBEAT_SECONDS = 90;

const toDateKey = (date = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
};

const dayDiff = (fromDateKey, toDateKeyValue) => {
  if (!fromDateKey || !toDateKeyValue) return 0;
  const from = new Date(`${fromDateKey}T00:00:00.000Z`);
  const to = new Date(`${toDateKeyValue}T00:00:00.000Z`);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
};

const dateKeyToDate = (dateKey) => new Date(`${dateKey}T00:00:00.000Z`);

const formatDateForLabel = (date, timezone) => new Intl.DateTimeFormat('en-NG', {
  timeZone: timezone,
  day: 'numeric',
  month: 'short',
}).format(date);

const normalizeRewardTable = (config) => {
  const cycleLength = Math.max(1, config?.cycleLengthDays || 7);
  const rewards = Array.isArray(config?.dailyRewards) && config.dailyRewards.length
    ? config.dailyRewards
    : DEFAULT_DAILY_REWARDS;

  return Array.from({ length: cycleLength }, (_, index) => {
    const match = rewards.find((reward) => Number(reward.day) === index + 1);
    return {
      day: index + 1,
      points: Number(match?.points ?? rewards[rewards.length - 1]?.points ?? 1),
    };
  });
};

const normalizeLeaderboardSettings = (leaderboard = {}) => {
  const rawMetrics = Array.isArray(leaderboard?.enabledMetrics)
    ? leaderboard.enabledMetrics
    : DEFAULT_LEADERBOARD_SETTINGS.enabledMetrics;
  const enabledMetrics = [...new Set(
    rawMetrics
      .map((metric) => String(metric || '').trim())
      .filter((metric) => LEADERBOARD_METRICS.includes(metric))
  )];
  const normalizedMetrics = enabledMetrics.length
    ? enabledMetrics
    : [...DEFAULT_LEADERBOARD_SETTINGS.enabledMetrics];

  const defaultMetricCandidate = String(
    leaderboard?.defaultMetric || DEFAULT_LEADERBOARD_SETTINGS.defaultMetric
  ).trim();
  const defaultMetric = normalizedMetrics.includes(defaultMetricCandidate)
    ? defaultMetricCandidate
    : normalizedMetrics[0];

  const defaultTimeframeCandidate = String(
    leaderboard?.defaultTimeframe || DEFAULT_LEADERBOARD_SETTINGS.defaultTimeframe
  ).trim();
  const defaultTimeframe = LEADERBOARD_TIMEFRAMES.includes(defaultTimeframeCandidate)
    ? defaultTimeframeCandidate
    : DEFAULT_LEADERBOARD_SETTINGS.defaultTimeframe;

  const refreshIntervalCandidate = Number(
    leaderboard?.refreshIntervalMinutes ?? DEFAULT_LEADERBOARD_SETTINGS.refreshIntervalMinutes
  );
  const topSizeCandidate = Number(
    leaderboard?.topSize ?? DEFAULT_LEADERBOARD_SETTINGS.topSize
  );

  return {
    enabled: typeof leaderboard?.enabled === 'boolean'
      ? leaderboard.enabled
      : DEFAULT_LEADERBOARD_SETTINGS.enabled,
    defaultMetric,
    enabledMetrics: normalizedMetrics,
    defaultTimeframe,
    refreshIntervalMinutes: Math.max(
      5,
      Math.min(
        1440,
        Number.isFinite(refreshIntervalCandidate)
          ? refreshIntervalCandidate
          : DEFAULT_LEADERBOARD_SETTINGS.refreshIntervalMinutes
      )
    ),
    topSize: Math.max(
      3,
      Math.min(
        50,
        Number.isFinite(topSizeCandidate)
          ? topSizeCandidate
          : DEFAULT_LEADERBOARD_SETTINGS.topSize
      )
    ),
  };
};

const getRewardPointsForDay = (config, cycleDay) => {
  const rewardTable = normalizeRewardTable(config);
  const normalizedDay = Math.max(1, Math.min(rewardTable.length, Number(cycleDay) || 1));
  return rewardTable.find((reward) => reward.day === normalizedDay)?.points ?? 1;
};

const ensureConfig = async () => {
  const existing = await LoginStreakConfigModel.findOne({ key: 'default' });
  if (existing) {
    let shouldSave = false;

    if (!Array.isArray(existing.dailyRewards) || existing.dailyRewards.length !== existing.cycleLengthDays) {
      existing.dailyRewards = normalizeRewardTable(existing);
      shouldSave = true;
    }

    const normalizedLeaderboard = normalizeLeaderboardSettings(existing.leaderboard || {});
    const currentLeaderboard = JSON.stringify(existing.leaderboard || {});
    const nextLeaderboard = JSON.stringify(normalizedLeaderboard);
    if (currentLeaderboard !== nextLeaderboard) {
      existing.leaderboard = normalizedLeaderboard;
      shouldSave = true;
    }

    if (shouldSave) {
      await existing.save();
    }

    return existing;
  }

  return LoginStreakConfigModel.create({
    key: 'default',
    minimumSessionMinutes: 12,
    dailyRewards: DEFAULT_DAILY_REWARDS,
    leaderboard: DEFAULT_LEADERBOARD_SETTINGS,
  });
};

const resetBrokenStreakIfNeeded = (user, todayDateKey) => {
  const streak = user.loginStreak || {};
  if (!streak.lastQualifiedDateKey) return false;

  const daysSinceLastQualified = dayDiff(streak.lastQualifiedDateKey, todayDateKey);
  if (daysSinceLastQualified > 1 && streak.currentStreak !== 0) {
    streak.currentStreak = 0;
    streak.lastRewardPoints = 0;
    user.markModified('loginStreak');
    return true;
  }

  return false;
};

const buildStatusPayload = ({ user, config, session, todayDateKey, recentlyQualified = false }) => {
  const streak = user.loginStreak || {};
  const rewardCycleDayCount = Number(streak.rewardCycleDayCount || 0);
  const cycleLengthDays = Math.max(1, config.cycleLengthDays || 7);
  const nextRewardDay = Math.min(cycleLengthDays, rewardCycleDayCount + 1);
  const todayRewardPoints = session?.status === 'qualified'
    ? Number(session.rewardPointsGranted || streak.lastRewardPoints || 0)
    : getRewardPointsForDay(config, nextRewardDay);

  const activeSecondsAccumulated = Number(session?.activeSecondsAccumulated || 0);
  const requiredActiveSeconds = Number(session?.requiredActiveSeconds || config.minimumSessionMinutes * 60);
  const remainingActiveSeconds = Math.max(0, requiredActiveSeconds - activeSecondsAccumulated);
  const qualifiedToday = Boolean(session?.status === 'qualified' || streak.lastRewardDateKey === todayDateKey);
  const pendingCyclePoints = Number(streak.pendingCyclePoints || 0);
  const withdrawablePoints = Number(streak.withdrawablePoints || 0);
  const pointValueNaira = Number(config.pointValueNaira || 150);

  return {
    sessionId: session?._id?.toString?.() || null,
    enabled: Boolean(config.enabled),
    timezone: config.timezone || DEFAULT_TIMEZONE,
    todayDateKey,
    currentStreak: Number(streak.currentStreak || 0),
    longestStreak: Number(streak.longestStreak || 0),
    qualifiedToday,
    recentlyQualified,
    activeSecondsAccumulated,
    requiredActiveSeconds,
    remainingActiveSeconds,
    rewardCycleDayCount,
    cycleLengthDays,
    nextRewardDay,
    todayRewardPoints,
    todayRewardNaira: todayRewardPoints * pointValueNaira,
    lastRewardPoints: Number(streak.lastRewardPoints || 0),
    lastRewardDateKey: streak.lastRewardDateKey || null,
    pendingCyclePoints,
    pendingCycleNaira: pendingCyclePoints * pointValueNaira,
    withdrawablePoints,
    withdrawableNaira: withdrawablePoints * pointValueNaira,
    totalPointsEarned: Number(streak.totalPointsEarned || 0),
    totalPointsWithdrawn: Number(streak.totalPointsWithdrawn || 0),
    totalNairaWithdrawn: Number(streak.totalNairaWithdrawn || 0),
    pointValueNaira,
    minimumSessionMinutes: Number(config.minimumSessionMinutes || 12),
    canWithdraw: withdrawablePoints > 0,
    sessionStartedAt: session?.startedAt || null,
    sessionQualifiedAt: session?.qualifiedAt || null,
    streakMessage: qualifiedToday
      ? `Today's check-in is complete. ${todayRewardPoints} point${todayRewardPoints === 1 ? '' : 's'} added.`
      : `Stay in the app for ${Math.ceil(remainingActiveSeconds / 60)} more minute${Math.ceil(remainingActiveSeconds / 60) === 1 ? '' : 's'} to claim today's reward.`,
  };
};

const creditWalletForWithdrawal = async ({ user, walletType, points, pointValueNaira, session }) => {
  const amount = Number(points) * Number(pointValueNaira);
  const wallet = user.wallets?.[walletType];

  if (!wallet) {
    throw new Error(`Wallet type "${walletType}" is not available`);
  }

  wallet.balance += amount;

  const reference = `STRK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const transaction = {
    _id: new mongoose.Types.ObjectId(),
    reference,
    amount,
    type: 'credit',
    category: 'bonus',
    status: 'completed',
    description: `Daily login streak withdrawal (${points} point${points === 1 ? '' : 's'})`,
    gateway: 'system',
    currency: 'NGN',
    processedAt: new Date(),
    meta: {
      source: 'login_streak',
      points,
      pointValueNaira,
      walletType,
    },
  };

  wallet.transactions.unshift(transaction);

  const auditTransaction = new TransactionModel({
    reference,
    amount,
    type: 'credit',
    category: 'bonus',
    status: 'completed',
    description: `Daily login streak withdrawal to ${walletType} wallet`,
    gateway: 'system',
    currency: 'NGN',
    processedAt: new Date(),
    meta: {
      source: 'login_streak',
      userId: user._id,
      walletType,
      points,
      pointValueNaira,
    },
  });

  await auditTransaction.save({ session });
  return { amount, reference };
};

const getLeaderboardWindow = (timeframe, timezone) => {
  const normalizedTimeframe = LEADERBOARD_TIMEFRAMES.includes(timeframe) ? timeframe : 'weekly';
  const days = LEADERBOARD_WINDOW_DAYS[normalizedTimeframe];
  const now = new Date();
  const startDate = new Date(now.getTime() - ((days - 1) * 86400000));
  const startDateKey = toDateKey(startDate, timezone);
  const endDateKey = toDateKey(now, timezone);

  const periodStartedAt = dateKeyToDate(startDateKey);
  const periodEndsAt = new Date(dateKeyToDate(endDateKey).getTime() + 86399999);

  let periodLabel = 'Last 7 days';
  if (normalizedTimeframe === 'daily') {
    periodLabel = 'Today';
  } else if (normalizedTimeframe === 'monthly') {
    periodLabel = 'Last 30 days';
  }

  return {
    timeframe: normalizedTimeframe,
    days,
    startDateKey,
    endDateKey,
    periodKey: `${normalizedTimeframe}:${startDateKey}:${endDateKey}`,
    periodStartedAt,
    periodEndsAt,
    periodLabel,
    periodRangeLabel: normalizedTimeframe === 'daily'
      ? formatDateForLabel(periodStartedAt, timezone)
      : `${formatDateForLabel(periodStartedAt, timezone)} - ${formatDateForLabel(periodEndsAt, timezone)}`,
  };
};

const calculateLongestConsecutiveRun = (dateKeys = []) => {
  if (!dateKeys.length) return 0;

  const uniqueDateKeys = [...new Set(dateKeys)].sort();
  let longest = 1;
  let current = 1;

  for (let index = 1; index < uniqueDateKeys.length; index += 1) {
    if (dayDiff(uniqueDateKeys[index - 1], uniqueDateKeys[index]) === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
};

const getStreakMetricValue = ({ timeframe, currentStreak, timeframeBestStreak }) => (
  timeframe === 'daily'
    ? currentStreak
    : timeframeBestStreak
);

const compareLeaderboardRows = (left, right, metric, timeframe) => {
  const leftStreakValue = getStreakMetricValue({
    timeframe,
    currentStreak: left.currentStreak,
    timeframeBestStreak: left.timeframeBestStreak,
  });
  const rightStreakValue = getStreakMetricValue({
    timeframe,
    currentStreak: right.currentStreak,
    timeframeBestStreak: right.timeframeBestStreak,
  });

  if (metric === 'points') {
    return (
      right.timeframePoints - left.timeframePoints ||
      rightStreakValue - leftStreakValue ||
      right.currentStreak - left.currentStreak ||
      right.timeframeQualifiedDays - left.timeframeQualifiedDays ||
      left.displayName.localeCompare(right.displayName)
    );
  }

  if (metric === 'streak') {
    return (
      rightStreakValue - leftStreakValue ||
      right.timeframePoints - left.timeframePoints ||
      right.currentStreak - left.currentStreak ||
      right.timeframeQualifiedDays - left.timeframeQualifiedDays ||
      left.displayName.localeCompare(right.displayName)
    );
  }

  return (
    right.score - left.score ||
    right.timeframePoints - left.timeframePoints ||
    rightStreakValue - leftStreakValue ||
    right.currentStreak - left.currentStreak ||
    left.displayName.localeCompare(right.displayName)
  );
};

const isSnapshotFresh = (snapshot, config, requestedLimit) => {
  if (!snapshot) return false;

  const leaderboardConfig = normalizeLeaderboardSettings(config.leaderboard || {});
  if (snapshot.limit < requestedLimit) {
    return false;
  }

  if (config.updatedAt && snapshot.computedAt < config.updatedAt) {
    return false;
  }

  const refreshIntervalMs = leaderboardConfig.refreshIntervalMinutes * 60000;
  return (Date.now() - new Date(snapshot.computedAt).getTime()) < refreshIntervalMs;
};

const buildLeaderboardResponse = ({
  snapshot,
  config,
  timeframe,
  metric,
  requestedLimit,
  currentUserId,
}) => {
  const leaderboardConfig = normalizeLeaderboardSettings(config.leaderboard || {});
  const entries = (snapshot?.entries || [])
    .slice(0, requestedLimit)
    .map((entry) => ({
      rank: entry.rank,
      userId: entry.user?.toString?.() || entry.user,
      uid: entry.uid,
      displayName: entry.displayName,
      avatar: entry.avatar || null,
      role: entry.role,
      currentStreak: Number(entry.currentStreak || 0),
      longestStreak: Number(entry.longestStreak || 0),
      timeframeQualifiedDays: Number(entry.timeframeQualifiedDays || 0),
      timeframeBestStreak: Number(entry.timeframeBestStreak || 0),
      timeframePoints: Number(entry.timeframePoints || 0),
      totalPointsEarned: Number(entry.totalPointsEarned || 0),
      score: Number(entry.score || 0),
      isCurrentUser: Boolean(currentUserId && `${entry.user}` === `${currentUserId}`),
    }));

  return {
    success: true,
    data: {
      enabled: leaderboardConfig.enabled,
      timeframe,
      metric,
      topSize: leaderboardConfig.topSize,
      availableMetrics: leaderboardConfig.enabledMetrics,
      defaultMetric: leaderboardConfig.defaultMetric,
      defaultTimeframe: leaderboardConfig.defaultTimeframe,
      refreshIntervalMinutes: leaderboardConfig.refreshIntervalMinutes,
      pointValueNaira: Number(config.pointValueNaira || 150),
      periodKey: snapshot?.periodKey || null,
      periodStartedAt: snapshot?.periodStartedAt || null,
      periodEndsAt: snapshot?.periodEndsAt || null,
      periodLabel: snapshot?.meta?.periodLabel || null,
      periodRangeLabel: snapshot?.meta?.periodRangeLabel || null,
      generatedAt: snapshot?.computedAt || null,
      totalEligibleUsers: Number(snapshot?.totalEligibleUsers || 0),
      entries,
    },
  };
};

const computeLeaderboardSnapshot = async ({
  config,
  timeframe,
  metric,
  limit,
}) => {
  const timezone = config.timezone || DEFAULT_TIMEZONE;
  const window = getLeaderboardWindow(timeframe, timezone);

  const sessionRows = await LoginStreakSessionModel.aggregate([
    {
      $match: {
        status: 'qualified',
        dateKey: {
          $gte: window.startDateKey,
          $lte: window.endDateKey,
        },
      },
    },
    {
      $group: {
        _id: '$user',
        timeframePoints: { $sum: '$rewardPointsGranted' },
        timeframeQualifiedDays: { $sum: 1 },
        dateKeys: { $addToSet: '$dateKey' },
      },
    },
  ])
    .allowDiskUse(true)
    .exec();

  const userIds = sessionRows.map((row) => row._id);
  const users = await UserModel.find({
    _id: { $in: userIds },
    role: { $in: ['marketer', 'promoter'] },
    isDeleted: { $ne: true },
    isActive: { $ne: false },
  })
    .select('_id uid displayName avatar role loginStreak')
    .lean();

  const userLookup = new Map(users.map((user) => [String(user._id), user]));

  const rows = sessionRows
    .map((row) => {
      const user = userLookup.get(String(row._id));
      if (!user) {
        return null;
      }

      const currentStreak = Number(user.loginStreak?.currentStreak || 0);
      const longestStreak = Number(user.loginStreak?.longestStreak || 0);
      const timeframePoints = Number(row.timeframePoints || 0);
      const timeframeQualifiedDays = Number(row.timeframeQualifiedDays || 0);
      const timeframeBestStreak = calculateLongestConsecutiveRun(row.dateKeys || []);
      const streakMetricValue = getStreakMetricValue({
        timeframe,
        currentStreak,
        timeframeBestStreak,
      });

      const score = metric === 'points'
        ? (timeframePoints * 1000) + (streakMetricValue * 10) + timeframeQualifiedDays
        : metric === 'streak'
          ? (streakMetricValue * 1000) + (timeframePoints * 10) + currentStreak
          : (streakMetricValue * 1000) + (timeframePoints * 100) + timeframeQualifiedDays;

      return {
        user: user._id,
        uid: user.uid,
        displayName: user.displayName || 'MarketSpase User',
        avatar: user.avatar || null,
        role: user.role,
        currentStreak,
        longestStreak,
        timeframeQualifiedDays,
        timeframeBestStreak,
        timeframePoints,
        totalPointsEarned: Number(user.loginStreak?.totalPointsEarned || 0),
        score,
      };
    })
    .filter(Boolean);

  rows.sort((left, right) => compareLeaderboardRows(left, right, metric, timeframe));

  const entries = rows.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    ...row,
  }));

  const snapshotPayload = {
    timeframe,
    metric,
    periodKey: window.periodKey,
    periodStartedAt: window.periodStartedAt,
    periodEndsAt: window.periodEndsAt,
    limit,
    totalEligibleUsers: rows.length,
    computedAt: new Date(),
    entries,
    meta: {
      periodLabel: window.periodLabel,
      periodRangeLabel: window.periodRangeLabel,
    },
  };

  return LeaderboardSnapshotModel.findOneAndUpdate(
    { timeframe, metric, periodKey: window.periodKey },
    { $set: snapshotPayload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const startLoginStreakSession = async (userId, metadata = {}) => {
  const config = await ensureConfig();
  if (!config.enabled) {
    const user = await UserModel.findById(userId).select('loginStreak role');
    return {
      success: true,
      data: buildStatusPayload({
        user: user || { loginStreak: {} },
        config,
        session: null,
        todayDateKey: toDateKey(new Date(), config.timezone || DEFAULT_TIMEZONE),
      }),
    };
  }

  const todayDateKey = toDateKey(new Date(), config.timezone || DEFAULT_TIMEZONE);
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  if (!['marketer', 'promoter'].includes(user.role)) {
    return {
      success: true,
      data: {
        ...buildStatusPayload({ user, config, session: null, todayDateKey }),
        enabled: false,
        streakMessage: 'Daily login rewards are available for marketers and promoters only.',
      },
    };
  }

  const streakReset = resetBrokenStreakIfNeeded(user, todayDateKey);
  if (streakReset) {
    await user.save();
  }

  let session = await LoginStreakSessionModel.findOne({ user: userId, dateKey: todayDateKey });
  if (!session) {
    session = await LoginStreakSessionModel.create({
      user: userId,
      dateKey: todayDateKey,
      timezone: config.timezone || DEFAULT_TIMEZONE,
      requiredActiveSeconds: Number(config.minimumSessionMinutes || 12) * 60,
      metadata: {
        userAgent: metadata.userAgent || null,
        ipAddress: metadata.ipAddress || null,
      },
    });
  }

  return {
    success: true,
    data: buildStatusPayload({ user, config, session, todayDateKey }),
  };
};

export const getLoginStreakStatus = async (userId) => {
  const config = await ensureConfig();
  const todayDateKey = toDateKey(new Date(), config.timezone || DEFAULT_TIMEZONE);
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  if (['marketer', 'promoter'].includes(user.role)) {
    const streakReset = resetBrokenStreakIfNeeded(user, todayDateKey);
    if (streakReset) {
      await user.save();
    }
  }

  const session = await LoginStreakSessionModel.findOne({ user: userId, dateKey: todayDateKey });

  return {
    success: true,
    data: buildStatusPayload({ user, config, session, todayDateKey }),
  };
};

export const pingLoginStreakSession = async (userId, sessionId = null) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const config = await ensureConfig();
    const todayDateKey = toDateKey(new Date(), config.timezone || DEFAULT_TIMEZONE);

    const user = await UserModel.findById(userId).session(mongoSession);
    if (!user) {
      throw new Error('User not found');
    }

    if (!['marketer', 'promoter'].includes(user.role)) {
      await mongoSession.commitTransaction();
      return {
        success: true,
        data: {
          ...buildStatusPayload({ user, config, session: null, todayDateKey }),
          enabled: false,
        },
      };
    }

    resetBrokenStreakIfNeeded(user, todayDateKey);

    const sessionQuery = sessionId
      ? { _id: sessionId, user: userId }
      : { user: userId, dateKey: todayDateKey };

    const streakSession = await LoginStreakSessionModel.findOne(sessionQuery).session(mongoSession);
    if (!streakSession) {
      throw new Error('Streak session not found');
    }

    const now = new Date();
    const previousPing = streakSession.lastPingAt || streakSession.startedAt || now;
    const deltaSeconds = Math.max(
      0,
      Math.min(MAX_HEARTBEAT_SECONDS, Math.floor((now.getTime() - previousPing.getTime()) / 1000))
    );

    streakSession.activeSecondsAccumulated += deltaSeconds;
    streakSession.lastPingAt = now;

    let recentlyQualified = false;
    if (streakSession.status !== 'qualified' && streakSession.activeSecondsAccumulated >= streakSession.requiredActiveSeconds) {
      const streak = user.loginStreak || {};
      const daysSinceLastQualified = streak.lastQualifiedDateKey
        ? dayDiff(streak.lastQualifiedDateKey, todayDateKey)
        : null;

      const nextStreak = daysSinceLastQualified === 1
        ? Number(streak.currentStreak || 0) + 1
        : 1;

      const nextRewardCycleDay = Number(streak.rewardCycleDayCount || 0) + 1;
      const cycleLengthDays = Math.max(1, config.cycleLengthDays || 7);
      const rewardPoints = getRewardPointsForDay(config, nextRewardCycleDay);

      streak.currentStreak = nextStreak;
      streak.longestStreak = Math.max(Number(streak.longestStreak || 0), nextStreak);
      streak.lastQualifiedDateKey = todayDateKey;
      streak.lastQualifiedAt = now;
      streak.lastRewardPoints = rewardPoints;
      streak.lastRewardDateKey = todayDateKey;
      streak.totalPointsEarned = Number(streak.totalPointsEarned || 0) + rewardPoints;
      streak.pendingCyclePoints = Number(streak.pendingCyclePoints || 0) + rewardPoints;

      if (nextRewardCycleDay >= cycleLengthDays) {
        streak.withdrawablePoints = Number(streak.withdrawablePoints || 0) + Number(streak.pendingCyclePoints || 0);
        streak.pendingCyclePoints = 0;
        streak.rewardCycleDayCount = 0;
      } else {
        streak.rewardCycleDayCount = nextRewardCycleDay;
      }

      streakSession.status = 'qualified';
      streakSession.qualifiedAt = now;
      streakSession.rewardPointsGranted = rewardPoints;
      streakSession.streakAfterQualification = nextStreak;
      streakSession.payoutCycleDayAfterQualification = streak.rewardCycleDayCount;
      user.markModified('loginStreak');
      recentlyQualified = true;
    }

    await user.save({ session: mongoSession });
    await streakSession.save({ session: mongoSession });
    await mongoSession.commitTransaction();

    if (recentlyQualified) {
      await evaluateUserBadges(user._id, {
        force: true,
        trigger: 'login_streak_qualified',
      }).catch((badgeError) => {
        console.error('Badge evaluation after streak qualification failed:', badgeError);
      });
    }

    return {
      success: true,
      data: buildStatusPayload({
        user,
        config,
        session: streakSession,
        todayDateKey,
        recentlyQualified,
      }),
    };
  } catch (error) {
    await mongoSession.abortTransaction();
    throw error;
  } finally {
    mongoSession.endSession();
  }
};

export const withdrawLoginStreakPoints = async (userId, { walletType = 'marketer', points = null } = {}) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const config = await ensureConfig();
    const user = await UserModel.findById(userId).session(mongoSession);

    if (!user) {
      throw new Error('User not found');
    }

    if (!['marketer', 'promoter'].includes(walletType)) {
      throw new Error('Invalid wallet type');
    }

    const streak = user.loginStreak || {};
    const availablePoints = Number(streak.withdrawablePoints || 0);
    if (availablePoints <= 0) {
      throw new Error('No withdrawable streak points available');
    }

    const pointsToWithdraw = points == null ? availablePoints : Number(points);
    if (!Number.isFinite(pointsToWithdraw) || pointsToWithdraw <= 0) {
      throw new Error('Withdrawal points must be greater than zero');
    }

    if (pointsToWithdraw > availablePoints) {
      throw new Error('Requested withdrawal exceeds available streak points');
    }

    const { amount, reference } = await creditWalletForWithdrawal({
      user,
      walletType,
      points: pointsToWithdraw,
      pointValueNaira: config.pointValueNaira || 150,
      session: mongoSession,
    });

    streak.withdrawablePoints = availablePoints - pointsToWithdraw;
    streak.totalPointsWithdrawn = Number(streak.totalPointsWithdrawn || 0) + pointsToWithdraw;
    streak.totalNairaWithdrawn = Number(streak.totalNairaWithdrawn || 0) + amount;
    streak.lastWithdrawalAt = new Date();
    user.markModified('loginStreak');

    await user.save({ session: mongoSession });
    await mongoSession.commitTransaction();

    const todayDateKey = toDateKey(new Date(), config.timezone || DEFAULT_TIMEZONE);
    const streakSession = await LoginStreakSessionModel.findOne({ user: userId, dateKey: todayDateKey });

    return {
      success: true,
      message: `Successfully moved ${pointsToWithdraw} streak point${pointsToWithdraw === 1 ? '' : 's'} to your ${walletType} wallet.`,
      data: {
        walletType,
        pointsWithdrawn: pointsToWithdraw,
        amountCredited: amount,
        reference,
        status: buildStatusPayload({
          user,
          config,
          session: streakSession,
          todayDateKey,
        }),
      },
    };
  } catch (error) {
    await mongoSession.abortTransaction();
    throw error;
  } finally {
    mongoSession.endSession();
  }
};

export const getLeaderboard = async (currentUserId, query = {}) => {
  const config = await ensureConfig();
  const leaderboardConfig = normalizeLeaderboardSettings(config.leaderboard || {});

  const requestedTimeframe = String(query.timeframe || leaderboardConfig.defaultTimeframe).trim();
  const timeframe = LEADERBOARD_TIMEFRAMES.includes(requestedTimeframe)
    ? requestedTimeframe
    : leaderboardConfig.defaultTimeframe;

  const requestedMetric = String(query.metric || leaderboardConfig.defaultMetric).trim();
  const metric = leaderboardConfig.enabledMetrics.includes(requestedMetric)
    ? requestedMetric
    : leaderboardConfig.defaultMetric;

  const requestedLimitCandidate = Number(query.limit ?? leaderboardConfig.topSize ?? 10);
  const requestedLimit = Math.max(
    1,
    Math.min(
      leaderboardConfig.topSize,
      Number.isFinite(requestedLimitCandidate)
        ? requestedLimitCandidate
        : leaderboardConfig.topSize
    )
  );

  if (!leaderboardConfig.enabled) {
    return {
      success: true,
      data: {
        enabled: false,
        timeframe,
        metric,
        topSize: leaderboardConfig.topSize,
        availableMetrics: leaderboardConfig.enabledMetrics,
        defaultMetric: leaderboardConfig.defaultMetric,
        defaultTimeframe: leaderboardConfig.defaultTimeframe,
        refreshIntervalMinutes: leaderboardConfig.refreshIntervalMinutes,
        pointValueNaira: Number(config.pointValueNaira || 150),
        periodKey: null,
        periodStartedAt: null,
        periodEndsAt: null,
        periodLabel: null,
        periodRangeLabel: null,
        generatedAt: null,
        totalEligibleUsers: 0,
        entries: [],
      },
    };
  }

  const window = getLeaderboardWindow(timeframe, config.timezone || DEFAULT_TIMEZONE);
  let snapshot = await LeaderboardSnapshotModel.findOne({
    timeframe,
    metric,
    periodKey: window.periodKey,
  }).lean();

  if (!isSnapshotFresh(snapshot, config, requestedLimit)) {
    snapshot = await computeLeaderboardSnapshot({
      config,
      timeframe,
      metric,
      limit: Math.max(requestedLimit, leaderboardConfig.topSize),
    });
  }

  return buildLeaderboardResponse({
    snapshot,
    config,
    timeframe,
    metric,
    requestedLimit,
    currentUserId,
  });
};

export const getAdminLoginStreakConfig = async () => {
  const config = await ensureConfig();
  return {
    success: true,
    data: {
      enabled: config.enabled,
      timezone: config.timezone,
      minimumSessionMinutes: config.minimumSessionMinutes,
      cycleLengthDays: config.cycleLengthDays,
      pointValueNaira: config.pointValueNaira,
      dailyRewards: normalizeRewardTable(config),
      leaderboard: normalizeLeaderboardSettings(config.leaderboard || {}),
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    },
  };
};

export const updateAdminLoginStreakConfig = async (adminId, payload = {}) => {
  const config = await ensureConfig();

  if (typeof payload.enabled === 'boolean') {
    config.enabled = payload.enabled;
  }

  if (payload.timezone) {
    config.timezone = String(payload.timezone).trim() || DEFAULT_TIMEZONE;
  }

  if (Number.isFinite(Number(payload.minimumSessionMinutes))) {
    config.minimumSessionMinutes = Math.max(1, Number(payload.minimumSessionMinutes));
  }

  if (Number.isFinite(Number(payload.cycleLengthDays))) {
    config.cycleLengthDays = Math.max(1, Number(payload.cycleLengthDays));
  }

  if (Number.isFinite(Number(payload.pointValueNaira))) {
    config.pointValueNaira = Math.max(1, Number(payload.pointValueNaira));
  }

  if (Array.isArray(payload.dailyRewards)) {
    config.dailyRewards = payload.dailyRewards.map((reward, index) => ({
      day: Math.max(1, Number(reward.day || index + 1)),
      points: Math.max(0, Number(reward.points || 0)),
    }));
  }

  if (payload.leaderboard && typeof payload.leaderboard === 'object') {
    const currentLeaderboard = normalizeLeaderboardSettings(config.leaderboard || {});
    config.leaderboard = normalizeLeaderboardSettings({
      ...currentLeaderboard,
      ...payload.leaderboard,
    });
  }

  config.dailyRewards = normalizeRewardTable(config);
  config.leaderboard = normalizeLeaderboardSettings(config.leaderboard || {});
  config.updatedBy = adminId;
  await config.save();

  return getAdminLoginStreakConfig();
};
