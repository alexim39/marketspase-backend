# MarketSpase Badge And Level System

## Purpose

The badge system celebrates meaningful marketer and promoter milestones without changing the core wallet and payout flows. It is designed to be configurable, secure, and safe for the live MarketSpase product.

## Core Data Models

### `BadgeConfig`

Stored in `src/apps/badges/models/badge-config.model.js`

- `enabled`
- `feedRefreshMinutes`
- `evaluationCooldownMinutes`
- `celebrationWindowHours`
- `levelThresholds[]`

This document controls how often badge data should feel fresh, how quickly repeated evaluation can happen, and how XP maps to user levels.

### `BadgeDefinition`

Stored in `src/apps/badges/models/badge-definition.model.js`

- `key`
- `title`
- `description`
- `shortDescription`
- `icon`
- `accentColor`
- `category`
- `roles[]`
- `criteria.metric`
- `criteria.targetValue`
- `reward.experiencePoints`
- `reward.label`
- `isActive`
- `isFeatured`
- `sortOrder`

This is the admin-managed badge library. New badge types can be added without changing code as long as they use one of the supported metrics.

### `UserBadge`

Stored in `src/apps/badges/models/user-badge.model.js`

- `user`
- `badge`
- `badgeKey`
- `titleSnapshot`
- `descriptionSnapshot`
- `iconSnapshot`
- `accentColorSnapshot`
- `categorySnapshot`
- `rewardSnapshot`
- `criteriaSnapshot`
- `metricValueAtUnlock`
- `progressPercentAtUnlock`
- `sourceEvent`
- `unlockedAt`
- `notifiedAt`

This is the user-badge relationship collection. It stores a snapshot of the badge at unlock time so historic awards remain stable even if the badge definition is edited later.

### `User.badgeProfile`

Stored in `src/apps/user/models/user/schemas/badgeProfile.schema.js`

- `level`
- `levelTitle`
- `experiencePoints`
- `badgesEarned`
- `lastBadgeUnlockedAt`
- `lastBadgeKey`
- `lastEvaluatedAt`

This is the lightweight summary copied onto the user document for fast profile and dashboard reads.

## Supported Badge Metrics

Current metrics supported by the badge engine:

- `login_streak_current`
- `login_streak_longest`
- `login_points_total`
- `campaigns_created`
- `campaign_clicks_billable`
- `promotions_accepted`
- `promotion_clicks_billable`
- `affiliate_sales_count`
- `affiliate_commission_total`
- `store_orders_paid`
- `community_posts_published`
- `followers_count`

## Awarding Flow

### Automatic evaluation triggers

Badge evaluation currently runs after these high-value events:

- daily streak qualification
- campaign creation
- campaign acceptance
- storefront payment confirmation
- marketer community post creation

Evaluation also runs when badge overview/feed endpoints are loaded, respecting the cooldown window.

### Real-time recognition

When a badge is newly awarded:

1. A `UserBadge` record is inserted
2. The user `badgeProfile` summary is recomputed
3. An in-app notification of type `badge_unlocked` is created
4. The dashboard badge feed can pick it up immediately or on the next refresh cycle

## API Surface

### User endpoints

Authenticated:

- `GET /api/v1/badges/me/feed`
- `GET /api/v1/badges/users/:userId/overview`

### Admin endpoints

Authenticated admin only:

- `GET /api/v1/badges/admin/config`
- `PUT /api/v1/badges/admin/config`
- `POST /api/v1/badges/admin/definitions`
- `PUT /api/v1/badges/admin/definitions/:badgeId`
- `DELETE /api/v1/badges/admin/definitions/:badgeId`

`DELETE` is soft-safe: if a badge has already been awarded, the definition is deactivated instead of hard-deleted.

## Frontend Surfaces

### Platform app

- Dashboard badge feed:
  - `projects/platform/src/app/dashboard/main-content/components/badge-feed`
- Profile badge section:
  - `projects/platform/src/app/profile/profile-page.component.*`
- Shared badge client:
  - `projects/platform/src/app/common/services/badge.service.ts`

### Admin app

- Badge settings and library:
  - `projects/admin/src/app/settings/badge-settings.component.*`
  - `projects/admin/src/app/settings/badge-settings.service.ts`

## Security Notes

- All badge APIs are behind the existing authenticated backend middleware.
- Admin configuration endpoints also require admin authorization.
- Badge progress is only returned in detail to authenticated users. The live profile consumes the authenticated route.
- The system never trusts frontend badge calculations.

## Operational Notes

- Default badge definitions are seeded automatically if missing.
- Level thresholds are configurable from admin and mirrored into the user summary after each evaluation.
- Badge rewards currently grant XP only. They do not change wallet balances or streak-point withdrawal rules.

## Recommended Future Extensions

- add more event hooks for follower milestones if follow routes are later tightened and modernized
- add badge analytics for admin reporting
- add curated public badge showcases on profile cards if product wants more social proof
