# Admin App Alignment

## Purpose

This pass realigns the admin application with the current live MarketSpase product model:

- Ads promotion and pay-per-click operations
- Storefront commerce and payouts
- Community feed and forum activity
- Rewards, streaks, badges, leaderboard, and gamification
- Multi-currency payment configuration

The goal is to keep the admin surface truthful, operational, and easier to extend without carrying legacy navigation promises that no longer match the live platform.

## What changed

### 1. Admin dashboard became a live operations center

The previous dashboard relied on incomplete or placeholder framing. It now uses real platform records.

Frontend:

- `projects/admin/src/app/dashboard/dashboard-main.component.ts`
- `projects/admin/src/app/dashboard/dashboard-main.component.html`
- `projects/admin/src/app/dashboard/dashboard-main.component.scss`

Backend:

- `src/apps/dashboard/controllers/stats.controller.js`
- `src/apps/dashboard/routes/stats.route.js`

New admin overview endpoint:

- `GET /dashboard/stats/admin-overview`

Returned sections:

- `users`
- `ads`
- `commerce`
- `community`
- `rewards`

### 2. Community operations page

Added a dedicated admin page for live social activity oversight.

Frontend:

- `projects/admin/src/app/dashboard/community-ops.component.ts`
- `projects/admin/src/app/dashboard/community-ops.component.html`
- `projects/admin/src/app/dashboard/community-ops.component.scss`

Route:

- `/dashboard/community`

This page is backed by the existing live activity feed endpoint:

- `GET /dashboard/stats/live-activity`

### 3. Navigation cleanup

The admin sidebar was reduced to areas that currently exist and are relevant to the live product:

- Overview
- Users
- Ads & Promotions
- Storefront
- Finance
- Community
- Rewards & Growth
- Settings

Removed from the active navigation structure:

- stale or unsupported analytics areas
- unused marketing/support shells
- settings groups that were not connected to a real route or capability

Main file:

- `projects/admin/src/app/dashboard/index.component.ts`

### 4. Admin header improvements

The header search is now a route jump tool instead of a decorative input.

It supports quick navigation into live admin areas and surfaces a small result list directly in the shell.

The header activity button now routes to the community desk and shows a live 24-hour activity pulse count.

Files:

- `projects/admin/src/app/dashboard/index.component.ts`
- `projects/admin/src/app/dashboard/index.component.html`
- `projects/admin/src/app/dashboard/index.component.scss`

### 5. Campaign details polish

The campaign details page no longer shows a "coming soon" activity log action. The header action now switches directly to the existing Activity Log tab.

Files:

- `projects/admin/src/app/campaign/campaign-details/campaign-details.component.ts`
- `projects/admin/src/app/campaign/campaign-details/campaign-details.component.html`

### 6. Backward-compatible newsletter route cleanup

The legacy typo route remains supported:

- `/dashboard/newletters`

Added alias:

- `/dashboard/newsletters`

Route file:

- `projects/admin/src/app/dashboard/dashborad.routes.ts`

### 7. Storefront moderation surfaces

The admin app now exposes two store-side moderation queues that were previously missing from the UI:

- product review approval / rejection / flag clearing / featuring
- storefront delivery release request review for escrowed orders

Frontend:

- `projects/admin/src/app/store/reviews/store-review-moderation.component.ts`
- `projects/admin/src/app/store/reviews/store-review-moderation.service.ts`
- `projects/admin/src/app/store/releases/storefront-release-requests.component.ts`

Routes:

- `/dashboard/stores/reviews`
- `/dashboard/stores/delivery-releases`

Backend support:

- `src/apps/store/controllers/admin/review.controller.js`
- `src/apps/store/routes/admin/store.routes.js`

Existing release-review backend endpoints are now surfaced in admin UI through:

- `GET /stores/storefront/orders/release-requests`
- `POST /stores/storefront/orders/:orderId/release-review`

## Notes for future maintenance

1. If a new admin capability is added, add the route first, then expose it in the sidebar.
2. Keep the dashboard summary driven by real data, not estimated placeholder cards.
3. The admin header search is intentionally route-based. If it grows into a global data search, build that as a separate service and keep route search fast.
4. The community activity pulse is currently based on the live activity summary's `total24h` value. If unread moderation state is added later, use a dedicated unread queue metric instead of overloading this badge.

## Verification

Verified after the alignment pass:

- `node --check src/apps/dashboard/controllers/stats.controller.js`
- `node --check src/apps/dashboard/routes/stats.route.js`
- `npx ng build admin --verbose`
- `npx tsc -p projects/admin/tsconfig.app.json --noEmit`

Current non-blocking warning:

- Sass `@import` deprecation warning in `projects/admin/src/app/financial/financial-mgt.component.scss`
