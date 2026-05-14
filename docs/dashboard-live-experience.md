# Dashboard Live Experience Refresh

## Purpose

This refresh removes dashboard placeholder behavior and rewires the home dashboard to use live records from MarketSpase activity across campaigns, storefronts, community feed, forum, gamification, and notifications.

## Backend additions

### `GET /dashboard/stats/live-activity`

Protected endpoint added in:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\dashboard\routes\stats.route.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\dashboard\controllers\live-activity.controller.js`

The endpoint aggregates recent:

- published feed posts
- forum threads
- campaign creations
- published products

Response shape:

```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "feed:...",
        "type": "post",
        "author": "Display Name",
        "authorId": "...",
        "avatar": "img/avatar.png",
        "role": "marketer",
        "title": "Post preview",
        "message": "shared a new social post",
        "createdAt": "2026-05-13T10:00:00.000Z",
        "actionUrl": "/feed/..."
      }
    ],
    "summary": {
      "feedPosts24h": 0,
      "forumThreads24h": 0,
      "campaigns24h": 0,
      "products24h": 0,
      "total24h": 0
    },
    "refreshedAt": "2026-05-13T10:00:00.000Z"
  }
}
```

## Frontend data sources

### Main dashboard container

Primary file:

- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\dashboard\main-content\main-content.component.ts`

Live data sources now used:

- `UserService.user` for wallet, streak, level, promotions, campaigns
- `FeedService` for community posts, trending hashtags, challenges, spotlight, forum hot topics, live toast data
- `ForumService.getCommunityStats()` for community-wide discussion totals
- `ProfileService.getProfile()` for user connections and likes
- `ProfileService.fetchSuggestedUsers()` and `getFollowing()` for follow suggestions/state
- `TutorialService.getTutorials()` for real learning content
- `DashboardService.getLiveActivityFeed()` for live social activity toast
- `NotificationService` for unread notification state

### Dashboard sections now backed by live records

- Performance cards:
  - campaign and wallet values use real user records
  - promoter earnings use real wallet and promotion state
  - level card uses `gamificationProfile`
- Quick stats:
  - community card uses real profile + activity log data
- Community feed:
  - uses real shared `FeedService`
  - no more dashboard-only simulated feed service
- Trending:
  - built from forum hot topics, trending hashtags, and live challenges
- People to follow:
  - built from creator spotlight, forum spotlight, suggested users, and following state
- Learning:
  - built from tutorial sections returned by the backend
- Notifications:
  - uses authenticated API reads instead of local mock behavior

## Live activity toast behavior

The dashboard community card now shows a live toast based on the authenticated dashboard live activity endpoint instead of simulated interval data.

Files:

- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\dashboard\main-content\components\community-feed\community-feed.component.ts`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\dashboard\main-content\components\community-feed\community-feed.component.html`

Behavior:

- displays the most recent live activity item
- clickable
- routes to:
  - `/feed/:postId` for feed post activity
  - forum thread detail for forum activity
  - campaign/store sections for campaign and product activity

## Daily check-in mobile adjustment

Files:

- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\dashboard\daily-check-in\daily-check-in.service.ts`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\dashboard\daily-check-in\daily-check-in.component.scss`

Changes:

- the streak prompt no longer auto-opens on mobile widths
- mobile users now see a compact floating chip anchored on the right side above the bottom nav
- the chip can be tapped to open the full streak panel without blocking the dashboard on load

## Notification behavior

Files:

- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\dashboard\notification\notification.service.ts`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\dashboard\notification\notification.component.ts`

Changes:

- notification API calls now use authenticated backend routes
- dashboard polling is single-source and idempotent
- the bell no longer starts its own duplicate polling loop

## Removed obsolete code

Deleted:

- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\dashboard\main-content\components\community-feed\community-feed.service.ts`

Reason:

- it simulated feed posts and live activities with local timers
- it no longer matched the live feed/forum backend
- the dashboard now uses the shared community `FeedService`

## Refresh cadence

Dashboard background refresh currently runs every 60 seconds for:

- profile snapshot
- forum stats
- live activity summary

Notification polling runs every 30 seconds.

The community feed itself is not force-reset every minute; it loads fresh on dashboard initialization and then stays stable unless the user navigates or a direct action updates it.

## Validation

Validated during implementation with:

- `npx.cmd tsc -p C:\Projects\marketspase-workspace\marketspase\projects\platform\tsconfig.app.json --noEmit`
- `npx.cmd ng build platform --verbose`
- `node --check C:\Projects\marketspase-workspace\marketspase-api\src\apps\dashboard\controllers\live-activity.controller.js`
- `node --check C:\Projects\marketspase-workspace\marketspase-api\src\apps\dashboard\routes\stats.route.js`

## Follow-up notes

- The platform build still shows older repo-wide Sass `@import` deprecation warnings outside this dashboard work.
- If a future dashboard detail page is added for individual live activities, update `actionUrl` generation in `live-activity.controller.js` and the click handler in the dashboard community card together.
