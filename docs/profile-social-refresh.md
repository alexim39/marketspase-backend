# Profile Social Refresh

## Summary

The MarketSpase profile experience now uses live platform records instead of static profile-only fields.

This refresh adds:

- richer public profile data for marketers and promoters
- linked social profiles managed from settings
- marketer business branding fields
- role-aware performance summaries on profile pages
- top campaign, product, and promotion highlights sourced from live app data

The changes are additive and backward compatible with the existing profile routes.

## Backend changes

### User schema

`professionalInfo` now supports:

- `profileHeadline`
- `businessProfile.brandName`
- `businessProfile.brandSummary`
- `businessProfile.uniqueSellingPoints[]`
- `socialProfiles.website`
- `socialProfiles.instagram`
- `socialProfiles.tiktok`
- `socialProfiles.facebook`
- `socialProfiles.x`
- `socialProfiles.youtube`
- `socialProfiles.linkedin`

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\user\models\user\schemas\professionalInfo.schema.js`

### Profile update APIs

`PUT /user/profile/profession`

Now updates:

- public headline
- marketer brand fields
- linked social profiles
- skills, hobbies, education, job title

The route continues to accept `userId`, but now prefers the authenticated `req.userId` when available.

Files:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\user\controllers\profile\update-user-professtion.controller.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\user\controllers\profile-update.controller.js`

### Public profile payload

`GET /profile/:userId/profile`

Existing fields are preserved, with these additions:

- `professionalInfo`
- `totalEngagements`
- `socialMetrics`
- `marketerProfile`
- `promoterProfile`

#### `socialMetrics`

Includes:

- feed post volume
- comments, shares, saves
- forum threads and replies
- follower growth for the last 30 days
- total cross-surface engagement

#### `marketerProfile`

Includes:

- `businessOverview`
- `storeSummary`
- `analytics`
- `performance`
- `topCampaigns`
- `topProducts`

#### `promoterProfile`

Includes:

- `analytics`
- `commissionSummary`
- `performance`
- `topCampaigns`
- `topProductPromotions`

Files:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\profile\controllers\user.controller.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\profile\routes\user.routes.js`

## Frontend changes

### Settings

The account professional settings form now supports:

- profile headline
- marketer branding
- unique selling points
- linked social profiles

Files:

- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\settings\account\professional\professional.component.ts`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\settings\account\professional\professional.component.html`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\settings\account\professional\professional.component.scss`

### Profile page

The profile page now renders:

- role-aware overview cards
- connected social profile links
- marketer business portfolio blocks
- promoter campaign and affiliate highlights
- mini analytics cards sourced from live data
- badges and gamification alongside performance context

Files:

- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\profile\profile-page.component.ts`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\profile\profile-page.component.html`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\profile\profile-page.component.scss`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\profile\services\profile.service.ts`
- `C:\Projects\marketspase-workspace\marketspase\projects\shared-services\src\lib\user.interface.ts`

## Data sources used for live metrics

The profile now aggregates from:

- feed posts
- follows
- forum threads
- forum comments
- campaigns
- stores
- products
- storefront promotion tracking
- accepted ad promotions
- paid storefront orders

## Notes for future updates

- No dedicated admin settings were added in this pass because the new profile fields are user-managed and do not require platform-level tuning.
- If moderation or verification of public social links becomes necessary later, add an admin review layer rather than changing the public profile payload shape.
- If custom avatar uploads are introduced later, update auth sync so Firebase login does not overwrite app-managed avatars.

## Verification

Verified during implementation:

- backend syntax checks with `node --check`
- frontend typecheck with `npx.cmd tsc -p projects/platform/tsconfig.app.json --noEmit`
- frontend production build with `npx.cmd ng build platform --verbose`
