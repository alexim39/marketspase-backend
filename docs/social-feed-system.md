# Social Feed System

## Overview

MarketSpase's social feed now supports a richer creator workflow for marketers and a more engaging discovery experience for promoters and other users. The system preserves the existing community feed routes while extending them with:

- personalized feed ranking
- campaign, product, and manual post creation
- rich media support for images, videos, and lightweight carousels
- hashtag and challenge discovery
- creator spotlight summaries
- external share tracking
- public post pages for shared links

The implementation is intentionally modular so recommendations, challenges, and additional post sources can evolve without rewriting the core feed controller layer.

## Backend Structure

### Core files

- `src/apps/feeds/models/feed/feed.schema.js`
- `src/apps/feeds/models/feed/feed.middleware.js`
- `src/apps/feeds/models/feed/feed.utils.js`
- `src/apps/feeds/models/feed/feed.constants.js`
- `src/apps/feeds/services/feed-discovery.service.js`
- `src/apps/feeds/controllers/create-post.controller.js`
- `src/apps/feeds/controllers/get-community-post.controller.js`
- `src/apps/feeds/controllers/get-post-byid.controller.js`
- `src/apps/feeds/controllers/get-posts.controller.js`
- `src/apps/feeds/controllers/add-comment.controller.js`
- `src/apps/feeds/controllers/share-post.controller.js`
- `src/apps/feeds/controllers/update-post.controller.js`
- `src/apps/feeds/controllers/delete-post.controller.js`
- `src/apps/feeds/routes/feed.route.js`

### Post model additions

The feed post document now supports:

- `source`: `manual | campaign | product`
- `type`: includes `product`, `story`, and `challenge`
- campaign snapshots for promotion posts
- product snapshots for storefront-driven posts
- ordered media items with `altText`, `thumbnail`, and `order`
- `socialMetrics.externalShares`
- `socialMetrics.chatClicks`
- `challenge` metadata
- `settings` for anonymous posting, comment control, and external sharing
- `recommendation` metadata used by the discovery service

The schema stores source snapshots so posts remain readable even if a campaign or product later changes.

## Recommendation and Discovery

### Feed types

`GET /feed/community` supports multiple discovery modes:

- `for_you`
- `following`
- `trending`
- `latest`

### Ranking signals

The discovery service scores posts using a blend of:

- relationship signals from followed authors
- recent engagement by the current user
- freshness boost
- post engagement totals
- media richness
- hashtag/challenge relevance
- spotlight quality indicators

The current ranking is request-time scoring, which is simple and safe for the current deployment size. If feed volume grows significantly, the next scaling step is to precompute candidate sets or cache ranked windows by segment.

### Discovery response shape

`GET /feed/community` returns:

- `posts`
- `pagination`
- `stats`
- `trendingHashtags`
- `trendingChallenges`
- `creatorSpotlight`
- `sortMode`

This lets the frontend render the feed, spotlight rail, and discovery modules from one request.

## Post Creation Flows

### 1. Campaign post

Marketer selects an existing campaign and optionally adds:

- original caption/content
- hashtags
- challenge metadata
- upload media override

The backend stores a campaign snapshot on the post for downstream display.

### 2. Product post

Marketer selects one of their published storefront products. The post automatically carries product context such as:

- name
- price
- category
- description
- store name/link

This makes it possible to promote products socially without first creating a campaign.

### 3. Manual/story post

Marketer can publish a direct social update with text and media, with no campaign or product dependency.

## Hashtags and Challenges

Hashtags are normalized by the feed model utilities and merged from:

- manual hashtag input
- content parsing
- challenge tag

Challenge posts use the `challenge` object for richer discovery and trend summaries. Trending challenges are aggregated from existing posts rather than a separate challenge collection, which keeps authoring lightweight while still supporting campaign-style participation loops.

## Interactions

Existing likes, comments, and shares are preserved.

Enhancements:

- comments now respect `settings.disableComments`
- shares increment both the visible `shareCount` and `socialMetrics.externalShares`
- WhatsApp contact taps increment the visible `chatCount` and `socialMetrics.chatClicks`
- public post links can be shared beyond the dashboard

`chatCount` is now treated as a first-class social engagement signal alongside likes, comments, and shares. It is included in:

- feed post payload shaping
- total engagement stats
- creator spotlight scoring
- challenge trend scoring
- recommendation ranking

## Public Sharing

Frontend public route:

- `/feed/:postId`

This route uses the existing post lookup endpoint and renders a public-friendly feed card so users can open shared links without being forced into the dashboard first.

Recommended deployment behavior:

- keep public post viewing open
- keep engagement actions authenticated

That matches the current implementation.

## Frontend Structure

### Core files

- `projects/platform/src/app/community/feeds/feed.service.ts`
- `projects/platform/src/app/community/feeds/feed-page.component.ts`
- `projects/platform/src/app/community/feeds/feed-page.component.html`
- `projects/platform/src/app/community/feeds/feed-page-mobile/feed-page-mobile.component.ts`
- `projects/platform/src/app/community/feeds/feed-post-card/feed-post-card.component.ts`
- `projects/platform/src/app/community/feeds/create/create-feed.component.ts`
- `projects/platform/src/app/community/feeds/public-feed-post.component.ts`
- `projects/platform/src/app/app.routes.ts`

### Frontend behaviors

- signal-backed feed state
- tabbed discovery modes
- search-aware feed loading
- creator spotlight section
- trending hashtags and challenges
- richer feed cards with product and challenge callouts
- media carousel behavior
- source-aware composer for campaign/product/manual posts
- external sharing via copy, WhatsApp, native share, and selected social targets
- WhatsApp contact engagement counting

### Responsive presentation

#### Mobile feed

The mobile feed is intentionally immersive and full-height:

- one post per viewport using vertical snap scrolling
- media-first presentation with overlay actions
- bottom-aligned creator/context metadata
- action rail for likes, comments, shares, saves, and WhatsApp contact taps

This layout is handled by `feed-page-mobile.component.*` and is designed to feel closer to short-form social apps while preserving MarketSpase's existing interaction flow.

#### Desktop feed

The desktop feed is optimized for density and scanning:

- wider central content rail
- compact rectangular cards in a two-column feed grid on large screens
- shared `FeedPostCardComponent` styling that supports side-by-side text/media presentation
- persistent right rail for search, topics, challenges, and creator/forum spotlight

On narrower desktop widths, the grid collapses safely to a single column without changing the underlying feed logic.

## API Summary

### Read

- `GET /api/v1/feed/community`
- `GET /api/v1/feed/:postId`
- `GET /api/v1/feed/posts`

### Write

- `POST /api/v1/feed/create`
- `PUT /api/v1/feed/:postId`
- `DELETE /api/v1/feed/:postId`
- `POST /api/v1/feed/:postId/comments`
- `POST /api/v1/feed/:postId/share`
- `POST /api/v1/feed/:postId/chat-click`
- existing like/save routes remain in use

### Multipart notes

`POST /feed/create` and `PUT /feed/:postId` accept multipart media using the `media` field. The current frontend uses multipart for create. Edit currently updates metadata only; media replacement can be added later without changing the route shape.

## Security and Ownership

- create/update/delete operations remain authenticated
- delete now uses authenticated `req.userId` rather than trusting request query identity
- source snapshots avoid repeated privileged lookups during read operations

When extending this system, keep actor identity derived from authenticated middleware rather than client-supplied user identifiers.

## Scalability Notes

Current design is suitable for the live app and moderate growth. When feed traffic becomes heavy, the next improvements should be:

1. cache trending hashtag and spotlight summaries
2. precompute recommendation candidates for active users
3. move heavy ranking into scheduled aggregation jobs
4. add pagination indexes for challenge/hashtag filters

## Known Follow-ups

- edit flow does not yet support replacing uploaded media
- challenge participation is post-driven rather than first-class campaign objects
- recommendation scoring is dynamic and can later be moved to cached snapshots

These are safe follow-ups, not blockers for the current live release.
