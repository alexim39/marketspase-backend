import { UserModel } from '../../models/user/index.js';
import { COUNTRY_PHONE_MAP } from '../../utils/country-phones.js';

const VALID_ROLES = new Set(['all', 'marketer', 'promoter', 'admin']);
const ISO_COUNTRY_LOOKUP = new Map(
  COUNTRY_PHONE_MAP.map((entry) => [String(entry.iso2 || '').trim().toLowerCase(), entry.name]),
);

const GENDER_LABELS = {
  male: 'Male',
  female: 'Female',
  non_binary: 'Non-binary',
  other: 'Other',
  unknown: 'Unknown',
};

const AGE_BAND_LABELS = {
  under_18: 'Under 18',
  age_18_24: '18-24',
  age_25_34: '25-34',
  age_35_44: '35-44',
  age_45_54: '45-54',
  age_55_plus: '55+',
  unknown: 'Unknown',
};

const ACTIVITY_LABELS = {
  last_7_days: 'Seen in 7 days',
  last_30_days: 'Seen in 30 days',
  last_90_days: 'Seen in 90 days',
  dormant: 'Dormant',
  never: 'Never seen',
};

const COMPLETION_LABELS = {
  starter: '0-39% complete',
  building: '40-59% complete',
  strong: '60-79% complete',
  complete: '80-100% complete',
};

const STREAK_LABELS = {
  none: 'No streak',
  warmup: '1-3 days',
  building: '4-7 days',
  committed: '8-14 days',
  elite: '15+ days',
};

const LEVEL_LABELS = {
  starter: 'Level 1',
  rising: 'Level 2-4',
  advanced: 'Level 5-9',
  elite: 'Level 10+',
};

const ORDERED_KEYS = {
  genders: ['male', 'female', 'non_binary', 'other', 'unknown'],
  ages: ['under_18', 'age_18_24', 'age_25_34', 'age_35_44', 'age_45_54', 'age_55_plus', 'unknown'],
  activity: ['last_7_days', 'last_30_days', 'last_90_days', 'dormant', 'never'],
  completion: ['starter', 'building', 'strong', 'complete'],
  streaks: ['none', 'warmup', 'building', 'committed', 'elite'],
  levels: ['starter', 'rising', 'advanced', 'elite'],
  roles: ['marketer', 'promoter', 'admin'],
};

const clampInteger = (value, min, max, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const titleCase = (value) => String(value || '')
  .split(/[\s_-]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const resolveCountryLabel = (key) => {
  if (!key || key === 'unknown') {
    return 'Unknown';
  }

  if (key.length === 2 && ISO_COUNTRY_LOOKUP.has(key)) {
    return ISO_COUNTRY_LOOKUP.get(key);
  }

  return titleCase(key);
};

const safeNumber = (value, precision = 0) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (precision <= 0) {
    return Math.round(numeric);
  }

  return Number(numeric.toFixed(precision));
};

const computeShare = (count, total) => {
  if (!total) {
    return 0;
  }

  return safeNumber((count / total) * 100, 1);
};

const formatDistribution = ({
  items = [],
  orderedKeys = [],
  labelMap = {},
  total = 0,
  formatter = null,
}) => {
  const itemMap = new Map(items.map((item) => [item._id, item]));
  const keys = orderedKeys.length > 0
    ? orderedKeys
    : items.map((item) => item._id);

  return keys
    .filter((key) => key !== undefined && key !== null)
    .map((key) => {
      const source = itemMap.get(key) || { _id: key, count: 0 };
      const base = {
        key,
        label: labelMap[key] || titleCase(key),
        count: safeNumber(source.count),
        share: computeShare(source.count, total),
      };

      return formatter ? formatter(base, source) : base;
    })
    .filter((entry) => entry.count > 0 || orderedKeys.length > 0);
};

const buildInsightCards = ({ summary, countries, states, ages, activity, role }) => {
  const insights = [];
  const audienceLabel = role === 'all' ? 'users' : `${role}s`;
  const totalUsers = summary.totalUsers || 0;

  if (countries[0]?.count > 0) {
    insights.push({
      title: 'Primary market',
      tone: 'info',
      message: `${countries[0].label} is the largest ${audienceLabel} market with ${countries[0].count.toLocaleString()} accounts (${countries[0].share}% of the audience).`,
    });
  }

  if (states[0]?.count > 0) {
    insights.push({
      title: 'Regional concentration',
      tone: 'accent',
      message: `${states[0].label}${states[0].countryLabel && states[0].countryLabel !== 'Unknown' ? `, ${states[0].countryLabel}` : ''} has the strongest concentration with ${states[0].count.toLocaleString()} users.`,
    });
  }

  if (ages[0]?.count > 0) {
    insights.push({
      title: 'Leading age band',
      tone: 'success',
      message: `${ages[0].label} is the largest age segment at ${ages[0].share}% of the total audience.`,
    });
  }

  const dormant = activity.find((item) => item.key === 'dormant');
  const neverSeen = activity.find((item) => item.key === 'never');
  if ((dormant?.count || 0) > 0 || (neverSeen?.count || 0) > 0) {
    const dormantCount = (dormant?.count || 0) + (neverSeen?.count || 0);
    insights.push({
      title: 'Reactivation opportunity',
      tone: 'warning',
      message: `${dormantCount.toLocaleString()} ${audienceLabel} have been dormant or never seen recently. That is ${computeShare(dormantCount, totalUsers)}% of the audience.`,
    });
  }

  if ((summary.averageProfileCompletion || 0) < 60) {
    insights.push({
      title: 'Profile depth gap',
      tone: 'warning',
      message: `Average profile completeness is ${summary.averageProfileCompletion}%. A profile-completion campaign could improve targeting quality and conversion readiness.`,
    });
  }

  return insights.slice(0, 4);
};

export const getUserAnalytics = async (req, res) => {
  try {
    const role = String(req.query.role || 'all').trim().toLowerCase();
    const windowDays = clampInteger(req.query.windowDays, 7, 3650, 90);
    const top = clampInteger(req.query.top, 5, 20, 10);
    const months = clampInteger(req.query.months, 3, 24, 12);

    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role filter. Use one of: all, marketer, promoter, admin.',
      });
    }

    const now = new Date();
    const recentThreshold = new Date(now.getTime() - (windowDays * 24 * 60 * 60 * 1000));
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    const monthlyStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const matchStage = { isDeleted: false };
    if (role !== 'all') {
      matchStage.role = role;
    }

    const [analytics] = await UserModel.aggregate([
      { $match: matchStage },
      {
        $project: {
          role: 1,
          isActive: 1,
          isVerified: 1,
          createdAt: 1,
          lastSeenAt: 1,
          totalBalance: {
            $add: [
              { $ifNull: ['$wallets.marketer.balance', 0] },
              { $ifNull: ['$wallets.promoter.balance', 0] },
            ],
          },
          currentStreak: { $ifNull: ['$loginStreak.currentStreak', 0] },
          totalPointsEarned: { $ifNull: ['$loginStreak.totalPointsEarned', 0] },
          currentLevel: { $ifNull: ['$gamificationProfile.currentLevel', 1] },
          totalXp: { $ifNull: ['$gamificationProfile.totalExperiencePoints', 0] },
          badgesEarned: { $ifNull: ['$badgeProfile.badgesEarned', 0] },
          totalReferrals: { $ifNull: ['$referralInfo.totalReferrals', 0] },
          ratingCount: { $ifNull: ['$ratingCount', 0] },
          countrySource: {
            $let: {
              vars: {
                countryText: { $trim: { input: { $ifNull: ['$personalInfo.address.country', ''] } } },
                phoneIso2: { $trim: { input: { $ifNull: ['$personalInfo.phoneDetails.iso2', ''] } } },
              },
              in: {
                $cond: [
                  { $gt: [{ $strLenCP: '$$countryText' }, 0] },
                  '$$countryText',
                  '$$phoneIso2',
                ],
              },
            },
          },
          stateSource: { $trim: { input: { $ifNull: ['$personalInfo.address.state', ''] } } },
          genderSource: { $trim: { input: { $ifNull: ['$personalInfo.gender', ''] } } },
          dob: '$personalInfo.dob',
          hasPhone: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$personalInfo.phone', ''] } }, 0] },
              1,
              0,
            ],
          },
          hasCountry: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$personalInfo.address.country', ''] } }, 0] },
              1,
              0,
            ],
          },
          hasState: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$personalInfo.address.state', ''] } }, 0] },
              1,
              0,
            ],
          },
          hasCity: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$personalInfo.address.city', ''] } }, 0] },
              1,
              0,
            ],
          },
          hasDob: {
            $cond: [
              { $ne: ['$personalInfo.dob', null] },
              1,
              0,
            ],
          },
          hasGender: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$personalInfo.gender', ''] } }, 0] },
              1,
              0,
            ],
          },
          hasBiography: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$personalInfo.biography', ''] } }, 0] },
              1,
              0,
            ],
          },
          hasAvatar: {
            $cond: [
              {
                $and: [
                  { $ne: ['$avatar', null] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$avatar', ''] } }, 0] },
                  { $ne: ['$avatar', '/img/avatar.png'] },
                ],
              },
              1,
              0,
            ],
          },
          hasHeadline: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$professionalInfo.profileHeadline', ''] } }, 0] },
              1,
              0,
            ],
          },
          hasBrandSummary: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$professionalInfo.businessProfile.brandSummary', ''] } }, 0] },
              1,
              0,
            ],
          },
          hasSocial: {
            $cond: [
              {
                $or: [
                  { $gt: [{ $strLenCP: { $ifNull: ['$professionalInfo.socialProfiles.website', ''] } }, 0] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$professionalInfo.socialProfiles.instagram', ''] } }, 0] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$professionalInfo.socialProfiles.tiktok', ''] } }, 0] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$professionalInfo.socialProfiles.facebook', ''] } }, 0] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$professionalInfo.socialProfiles.x', ''] } }, 0] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$professionalInfo.socialProfiles.youtube', ''] } }, 0] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$professionalInfo.socialProfiles.linkedin', ''] } }, 0] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          countryKey: {
            $toLower: {
              $cond: [
                { $gt: [{ $strLenCP: '$countrySource' }, 0] },
                '$countrySource',
                'unknown',
              ],
            },
          },
          stateKey: {
            $toLower: {
              $cond: [
                { $gt: [{ $strLenCP: '$stateSource' }, 0] },
                '$stateSource',
                'unknown',
              ],
            },
          },
          genderKey: {
            $let: {
              vars: {
                normalizedGender: {
                  $toLower: {
                    $cond: [
                      { $gt: [{ $strLenCP: '$genderSource' }, 0] },
                      '$genderSource',
                      'unknown',
                    ],
                  },
                },
              },
              in: {
                $switch: {
                  branches: [
                    { case: { $in: ['$$normalizedGender', ['male', 'man', 'm']] }, then: 'male' },
                    { case: { $in: ['$$normalizedGender', ['female', 'woman', 'f']] }, then: 'female' },
                    { case: { $in: ['$$normalizedGender', ['non-binary', 'non binary', 'non_binary']] }, then: 'non_binary' },
                    { case: { $eq: ['$$normalizedGender', 'other'] }, then: 'other' },
                  ],
                  default: {
                    $cond: [
                      { $eq: ['$$normalizedGender', 'unknown'] },
                      'unknown',
                      'other',
                    ],
                  },
                },
              },
            },
          },
          age: {
            $cond: [
              { $ne: ['$dob', null] },
              { $dateDiff: { startDate: '$dob', endDate: '$$NOW', unit: 'year' } },
              null,
            ],
          },
          profileCompletionScore: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      {
                        $add: [
                          '$hasPhone',
                          '$hasCountry',
                          '$hasState',
                          '$hasCity',
                          '$hasDob',
                          '$hasGender',
                          '$hasBiography',
                          '$hasAvatar',
                          '$hasHeadline',
                          '$hasBrandSummary',
                          '$hasSocial',
                        ],
                      },
                      11,
                    ],
                  },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          ageBand: {
            $switch: {
              branches: [
                { case: { $and: [{ $ne: ['$age', null] }, { $lt: ['$age', 18] }] }, then: 'under_18' },
                { case: { $and: [{ $gte: ['$age', 18] }, { $lte: ['$age', 24] }] }, then: 'age_18_24' },
                { case: { $and: [{ $gte: ['$age', 25] }, { $lte: ['$age', 34] }] }, then: 'age_25_34' },
                { case: { $and: [{ $gte: ['$age', 35] }, { $lte: ['$age', 44] }] }, then: 'age_35_44' },
                { case: { $and: [{ $gte: ['$age', 45] }, { $lte: ['$age', 54] }] }, then: 'age_45_54' },
                { case: { $gte: ['$age', 55] }, then: 'age_55_plus' },
              ],
              default: 'unknown',
            },
          },
          activitySegment: {
            $switch: {
              branches: [
                { case: { $and: [{ $ne: ['$lastSeenAt', null] }, { $gte: ['$lastSeenAt', sevenDaysAgo] }] }, then: 'last_7_days' },
                { case: { $and: [{ $ne: ['$lastSeenAt', null] }, { $gte: ['$lastSeenAt', thirtyDaysAgo] }] }, then: 'last_30_days' },
                { case: { $and: [{ $ne: ['$lastSeenAt', null] }, { $gte: ['$lastSeenAt', ninetyDaysAgo] }] }, then: 'last_90_days' },
                { case: { $ne: ['$lastSeenAt', null] }, then: 'dormant' },
              ],
              default: 'never',
            },
          },
          completionBand: {
            $switch: {
              branches: [
                { case: { $gte: ['$profileCompletionScore', 80] }, then: 'complete' },
                { case: { $gte: ['$profileCompletionScore', 60] }, then: 'strong' },
                { case: { $gte: ['$profileCompletionScore', 40] }, then: 'building' },
              ],
              default: 'starter',
            },
          },
          streakBand: {
            $switch: {
              branches: [
                { case: { $gte: ['$currentStreak', 15] }, then: 'elite' },
                { case: { $gte: ['$currentStreak', 8] }, then: 'committed' },
                { case: { $gte: ['$currentStreak', 4] }, then: 'building' },
                { case: { $gte: ['$currentStreak', 1] }, then: 'warmup' },
              ],
              default: 'none',
            },
          },
          levelBand: {
            $switch: {
              branches: [
                { case: { $gte: ['$currentLevel', 10] }, then: 'elite' },
                { case: { $gte: ['$currentLevel', 5] }, then: 'advanced' },
                { case: { $gte: ['$currentLevel', 2] }, then: 'rising' },
              ],
              default: 'starter',
            },
          },
          recentJoinWindow: {
            $cond: [{ $gte: ['$createdAt', recentThreshold] }, 1, 0],
          },
          activeWindow: {
            $cond: [
              { $and: [{ $ne: ['$lastSeenAt', null] }, { $gte: ['$lastSeenAt', recentThreshold] }] },
              1,
              0,
            ],
          },
        },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
                verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
                newUsersInWindow: { $sum: '$recentJoinWindow' },
                usersSeenInWindow: { $sum: '$activeWindow' },
                usersWithCompleteProfiles: { $sum: { $cond: [{ $gte: ['$profileCompletionScore', 80] }, 1, 0] } },
                usersWithSocialProfiles: { $sum: '$hasSocial' },
                activeStreakUsers: { $sum: { $cond: [{ $gt: ['$currentStreak', 0] }, 1, 0] } },
                highLevelUsers: { $sum: { $cond: [{ $gte: ['$currentLevel', 5] }, 1, 0] } },
                totalBalance: { $sum: '$totalBalance' },
                averageBalance: { $avg: '$totalBalance' },
                averageProfileCompletion: { $avg: '$profileCompletionScore' },
                averageAge: { $avg: '$age' },
                totalXp: { $sum: '$totalXp' },
                averageXp: { $avg: '$totalXp' },
                totalBadges: { $sum: '$badgesEarned' },
                totalPointsEarned: { $sum: '$totalPointsEarned' },
                totalReferrals: { $sum: '$totalReferrals' },
              },
            },
          ],
          roles: [
            { $group: { _id: '$role', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          countries: [
            {
              $group: {
                _id: '$countryKey',
                count: { $sum: 1 },
                activeCount: { $sum: { $cond: ['$isActive', 1, 0] } },
                verifiedCount: { $sum: { $cond: ['$isVerified', 1, 0] } },
                recentCount: { $sum: '$activeWindow' },
                averageProfileCompletion: { $avg: '$profileCompletionScore' },
                marketerCount: { $sum: { $cond: [{ $eq: ['$role', 'marketer'] }, 1, 0] } },
                promoterCount: { $sum: { $cond: [{ $eq: ['$role', 'promoter'] }, 1, 0] } },
                adminCount: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
              },
            },
            { $sort: { count: -1, activeCount: -1 } },
            { $limit: top },
          ],
          states: [
            { $match: { stateKey: { $ne: 'unknown' } } },
            {
              $group: {
                _id: {
                  countryKey: '$countryKey',
                  stateKey: '$stateKey',
                },
                count: { $sum: 1 },
                activeCount: { $sum: { $cond: ['$isActive', 1, 0] } },
                verifiedCount: { $sum: { $cond: ['$isVerified', 1, 0] } },
                recentCount: { $sum: '$activeWindow' },
                marketerCount: { $sum: { $cond: [{ $eq: ['$role', 'marketer'] }, 1, 0] } },
                promoterCount: { $sum: { $cond: [{ $eq: ['$role', 'promoter'] }, 1, 0] } },
                adminCount: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
              },
            },
            { $sort: { count: -1, activeCount: -1 } },
            { $limit: top },
          ],
          genders: [
            { $group: { _id: '$genderKey', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          ages: [
            { $group: { _id: '$ageBand', count: { $sum: 1 } } },
          ],
          activity: [
            { $group: { _id: '$activitySegment', count: { $sum: 1 } } },
          ],
          completion: [
            { $group: { _id: '$completionBand', count: { $sum: 1 } } },
          ],
          streaks: [
            { $group: { _id: '$streakBand', count: { $sum: 1 } } },
          ],
          levels: [
            { $group: { _id: '$levelBand', count: { $sum: 1 } } },
          ],
          monthlySignups: [
            { $match: { createdAt: { $gte: monthlyStart } } },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                  role: '$role',
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
          ],
          referralRegions: [
            {
              $group: {
                _id: '$countryKey',
                referralCount: { $sum: '$totalReferrals' },
                count: { $sum: 1 },
              },
            },
            { $sort: { referralCount: -1, count: -1 } },
            { $limit: top },
          ],
        },
      },
    ]);

    const summarySource = analytics?.summary?.[0] || {};
    const totalUsers = safeNumber(summarySource.totalUsers);

    const summary = {
      totalUsers,
      activeUsers: safeNumber(summarySource.activeUsers),
      verifiedUsers: safeNumber(summarySource.verifiedUsers),
      newUsersInWindow: safeNumber(summarySource.newUsersInWindow),
      usersSeenInWindow: safeNumber(summarySource.usersSeenInWindow),
      usersWithCompleteProfiles: safeNumber(summarySource.usersWithCompleteProfiles),
      usersWithSocialProfiles: safeNumber(summarySource.usersWithSocialProfiles),
      activeStreakUsers: safeNumber(summarySource.activeStreakUsers),
      highLevelUsers: safeNumber(summarySource.highLevelUsers),
      totalBalance: safeNumber(summarySource.totalBalance, 2),
      averageBalance: safeNumber(summarySource.averageBalance, 2),
      averageProfileCompletion: safeNumber(summarySource.averageProfileCompletion, 1),
      averageAge: safeNumber(summarySource.averageAge, 1),
      totalXp: safeNumber(summarySource.totalXp),
      averageXp: safeNumber(summarySource.averageXp, 1),
      totalBadges: safeNumber(summarySource.totalBadges),
      totalPointsEarned: safeNumber(summarySource.totalPointsEarned),
      totalReferrals: safeNumber(summarySource.totalReferrals),
      activeShare: computeShare(summarySource.activeUsers, totalUsers),
      verifiedShare: computeShare(summarySource.verifiedUsers, totalUsers),
      completeProfileShare: computeShare(summarySource.usersWithCompleteProfiles, totalUsers),
      windowSeenShare: computeShare(summarySource.usersSeenInWindow, totalUsers),
    };

    const roleDistribution = formatDistribution({
      items: analytics?.roles || [],
      orderedKeys: ORDERED_KEYS.roles,
      total: totalUsers,
      formatter: (base) => ({
        ...base,
        label: titleCase(base.key),
      }),
    });

    const countryDistribution = (analytics?.countries || []).map((item) => ({
      key: item._id,
      label: resolveCountryLabel(item._id),
      count: safeNumber(item.count),
      share: computeShare(item.count, totalUsers),
      activeCount: safeNumber(item.activeCount),
      verifiedCount: safeNumber(item.verifiedCount),
      recentCount: safeNumber(item.recentCount),
      averageProfileCompletion: safeNumber(item.averageProfileCompletion, 1),
      roleBreakdown: {
        marketer: safeNumber(item.marketerCount),
        promoter: safeNumber(item.promoterCount),
        admin: safeNumber(item.adminCount),
      },
    }));

    const stateDistribution = (analytics?.states || []).map((item) => ({
      key: `${item._id.countryKey}:${item._id.stateKey}`,
      label: titleCase(item._id.stateKey),
      countryKey: item._id.countryKey,
      countryLabel: resolveCountryLabel(item._id.countryKey),
      count: safeNumber(item.count),
      share: computeShare(item.count, totalUsers),
      activeCount: safeNumber(item.activeCount),
      verifiedCount: safeNumber(item.verifiedCount),
      recentCount: safeNumber(item.recentCount),
      roleBreakdown: {
        marketer: safeNumber(item.marketerCount),
        promoter: safeNumber(item.promoterCount),
        admin: safeNumber(item.adminCount),
      },
    }));

    const genderDistribution = formatDistribution({
      items: analytics?.genders || [],
      orderedKeys: ORDERED_KEYS.genders,
      labelMap: GENDER_LABELS,
      total: totalUsers,
    });

    const ageDistribution = formatDistribution({
      items: analytics?.ages || [],
      orderedKeys: ORDERED_KEYS.ages,
      labelMap: AGE_BAND_LABELS,
      total: totalUsers,
    });

    const activityDistribution = formatDistribution({
      items: analytics?.activity || [],
      orderedKeys: ORDERED_KEYS.activity,
      labelMap: ACTIVITY_LABELS,
      total: totalUsers,
    });

    const completionDistribution = formatDistribution({
      items: analytics?.completion || [],
      orderedKeys: ORDERED_KEYS.completion,
      labelMap: COMPLETION_LABELS,
      total: totalUsers,
    });

    const streakDistribution = formatDistribution({
      items: analytics?.streaks || [],
      orderedKeys: ORDERED_KEYS.streaks,
      labelMap: STREAK_LABELS,
      total: totalUsers,
    });

    const levelDistribution = formatDistribution({
      items: analytics?.levels || [],
      orderedKeys: ORDERED_KEYS.levels,
      labelMap: LEVEL_LABELS,
      total: totalUsers,
    });

    const monthlySignupsMap = new Map();
    for (const item of analytics?.monthlySignups || []) {
      const monthKey = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      if (!monthlySignupsMap.has(monthKey)) {
        monthlySignupsMap.set(monthKey, {
          key: monthKey,
          label: new Date(item._id.year, item._id.month - 1, 1).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          }),
          count: 0,
          roleBreakdown: { marketer: 0, promoter: 0, admin: 0 },
        });
      }

      const monthEntry = monthlySignupsMap.get(monthKey);
      monthEntry.count += safeNumber(item.count);
      if (monthEntry.roleBreakdown[item._id.role] !== undefined) {
        monthEntry.roleBreakdown[item._id.role] += safeNumber(item.count);
      }
    }

    const monthlySignups = Array.from(monthlySignupsMap.values()).map((entry) => ({
      ...entry,
      share: computeShare(entry.count, totalUsers),
    }));

    const referralRegions = (analytics?.referralRegions || []).map((item) => ({
      key: item._id,
      label: resolveCountryLabel(item._id),
      referralCount: safeNumber(item.referralCount),
      count: safeNumber(item.count),
      referralsPerUser: item.count ? safeNumber(item.referralCount / item.count, 1) : 0,
    }));

    const insights = buildInsightCards({
      summary,
      countries: countryDistribution,
      states: stateDistribution,
      ages: ageDistribution.filter((item) => item.key !== 'unknown'),
      activity: activityDistribution,
      role,
    });

    return res.status(200).json({
      success: true,
      message: 'User analytics fetched successfully.',
      data: {
        filters: {
          role,
          windowDays,
          top,
          months,
        },
        summary,
        distributions: {
          roles: roleDistribution,
          countries: countryDistribution,
          states: stateDistribution,
          genders: genderDistribution,
          ages: ageDistribution,
          activity: activityDistribution,
          profileCompletion: completionDistribution,
          streaks: streakDistribution,
          levels: levelDistribution,
          monthlySignups,
          referralRegions,
        },
        insights,
        generatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user analytics.',
    });
  }
};
