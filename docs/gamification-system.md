# MarketSpase Gamification System

## Purpose

The gamification engine unifies:

- daily streak progress
- badge unlock rewards
- leaderboard motivation
- campaign and promotion activity
- storefront sales activity

It is intentionally decoupled from campaign, streak, badge, and storefront business logic through an event-ledger service.

## Backend models

### `user.gamificationProfile`

Stored on the main user document for fast reads in dashboard/profile surfaces.

Key fields:

- `totalExperiencePoints`
- `currentLevel`
- `currentLevelTitle`
- `nextLevel`
- `experiencePointsToNextLevel`
- `progressPercent`
- `totalEvents`
- `milestonesUnlocked`
- `badgesUnlocked`
- `recentLevelUpAt`
- `lastActionKey`
- `lastMilestoneKey`

### `GamificationConfig`

Global admin-managed configuration.

Fields:

- `enabled`
- `refreshIntervalMinutes`
- `celebrationWindowHours`
- `actionRules[]`
- `levelThresholds[]`

### `GamificationEvent`

Append-only XP ledger.

Important fields:

- `user`
- `actionKey`
- `sourceKey`
- `sourceType`
- `sourceId`
- `experiencePointsAwarded`
- `metadata`
- `occurredAt`
- `awardedAt`

Uniqueness is enforced with:

- `user + actionKey + sourceKey`

This keeps hooks idempotent for live retries and refreshes.

### `UserGamificationMilestone`

Tracks unlocked level milestones separately from raw XP events.

Important fields:

- `user`
- `milestoneKey`
- `titleSnapshot`
- `rewardLabelSnapshot`
- `linkedBadgeKeySnapshot`
- `featureKeySnapshot`
- `minLevel`
- `sourceLevel`
- `unlockedAt`

## Event flow

The engine is called through:

- `awardGamificationProgress(...)`

Current live hooks:

1. `login_qualified`
   - source: streak qualification after required active session
2. `campaign_created`
   - source: marketer campaign creation
3. `promotion_accepted`
   - source: promoter campaign acceptance
4. `store_order_paid`
   - source: paid storefront order for marketer
5. `affiliate_sale_paid`
   - source: paid storefront order for promoter
6. `community_post_published`
   - source: marketer community post creation
7. `badge_unlocked`
   - source: badge engine unlock event
   - XP can inherit from badge reward metadata

## Notifications

The notification service now supports:

- `badge_unlocked`
- `level_up`
- `gamification_milestone_unlocked`

These surface through the existing notification infrastructure.

## APIs

### User APIs

- `GET /api/v1/gamification/me/dashboard`
- `GET /api/v1/gamification/me/feed`

### Admin APIs

- `GET /api/v1/gamification/admin/config`
- `PUT /api/v1/gamification/admin/config`

All gamification routes require auth.
Admin routes additionally require `requireAdmin`.

## Frontend surfaces

### Platform app

- dashboard spotlight card
- dedicated `/dashboard/gamification` journey page
- profile badge tab now reads unified XP/level data when available
- badge feed can display the unified gamification level summary

### Admin app

- `/dashboard/settings/gamification`

Admin can adjust:

- engine enabled state
- refresh cadence
- celebration window
- per-action XP rules
- level thresholds and milestone metadata

## Design notes

### Why an event ledger?

It prevents reward logic from being scattered across business modules and gives the system:

- idempotency
- auditability
- clean recalculation paths
- future analytics flexibility

### Why keep `badgeProfile` and `gamificationProfile` separate?

`badgeProfile` remains badge-domain state.
`gamificationProfile` becomes the unified progression summary used across the broader engagement journey.

This avoids breaking older badge-dependent UI or logic while allowing the new engine to expand safely.

## Operational guidance

- prefer new gamified actions to be added as action rules plus a single `awardGamificationProgress` hook
- keep `sourceKey` stable and deterministic
- avoid extremely high-volume actions unless aggregation or batching is added first
- use milestone reward labels and feature keys for non-financial unlock messaging

## Validation checklist

- user login still works
- streak qualification still works
- badge awards still work
- campaign create/accept still work
- storefront payment confirmation still works
- platform build passes
- admin build passes
