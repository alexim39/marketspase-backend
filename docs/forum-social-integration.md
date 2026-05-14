# MarketSpase Forum Social Integration

## Overview

The forum now behaves as a social extension of the MarketSpase feed instead of a separate text-only module.

Core upgrades:

- rich thread media with up to 6 image/video/audio items
- poll-enabled threads
- threaded replies stored directly on forum comments
- followable threads and topics
- hot topics and contributor spotlight discovery
- feed discovery payloads now include forum highlights and hot topics
- forum activity contributes to badges and gamification

## Backend model changes

### Thread model

File: `src/apps/forum/models/thread/thread.schema.js`

Added fields:

- `mediaItems[]`
- `topicTags[]`
- `poll`
- `followers[]`
- `followerCount`
- `shareCount`
- `engagementScore`
- `spotlightScore`

Compatibility:

- legacy `media` remains available and mirrors the first `mediaItems` entry

### Comment model

File: `src/apps/forum/models/comment/comment.schema.js`

Added fields:

- `replies[]`
- `replyCount`
- `isReply`

### User forum activity

File: `src/apps/user/models/user/schemas/forum.schema.js`

Added fields:

- `followedThreads[]`
- `followedTopics[]`

## New / updated API behavior

Base route: `/forum`

### Threads

- `POST /threads/new`
  - accepts multipart form data
  - supports `media` files, `tags`, `topicTags`, `category`, `poll`
- `GET /threads`
  - supports pagination, `sortBy`, `category`, `tag`, `topic`, `search`, `following`
- `GET /thread/:id`
  - returns shaped thread + nested comments
- `PUT /threads/:threadId`
  - supports title/content/tag/topic/category/poll updates
- `DELETE /thread/:threadId/me`
  - authenticated self-delete path
- `POST /thread/:threadId/follow`
  - toggles thread follow
- `POST /thread/:threadId/poll/vote`
  - records a poll vote

### Comments

- `POST /thread/comment/new`
- `POST /thread/comment/reply`
- `POST /comments/like`
- `POST /comments/reply/like`
- `PUT /comments/:commentId`
- `DELETE /comment/:commentId/me`
- `DELETE /reply/:replyId/me`

### Discovery / stats

- `GET /stats`
- `GET /threads/pinned`
- `GET /threads/trending`
- `GET /topics/hot`
- `GET /users/active`
- `GET /tags/popular`
- `GET /categories`
- `GET /follows`
- `POST /topics/:topic/follow`

## Feed integration

File: `src/apps/feeds/services/feed-discovery.service.js`

Community feed discovery payload now includes:

- `forumHighlights`
- `hotTopics`
- `forumSpotlight`

These are consumed by the platform feed UI so social-feed users see rising forum conversations without leaving the feed context.

## Recognition and progression

### Gamification

File: `src/apps/gamification/models/gamification.constants.js`

Added action keys:

- `forum_thread_created`
- `forum_comment_created`

### Badges

Files:

- `src/apps/badges/models/badge-definition.model.js`
- `src/apps/badges/service/badge.service.js`

Added metrics:

- `forum_threads_created`
- `forum_comments_created`
- `forum_engagement_score`

Seeded default badges:

- `forum-threads-3`
- `forum-comments-15`

## Frontend flow

### Feed

Files:

- `projects/platform/src/app/community/feeds/feed.service.ts`
- `projects/platform/src/app/community/feeds/feed-page.component.*`

The feed now shows:

- hot discussion cards
- hot topics
- forum spotlight creators

### Forum

Files:

- `projects/platform/src/app/community/forum/forum.service.ts`
- `forum-page.component.*`
- `create-thread/*`
- `thread/thread-detail/*`

Users can now:

- create multimedia discussions
- add poll threads
- follow topics
- follow threads
- vote in polls
- reply in nested conversation flows

## Notes for maintenance

- `forum-social.service.js` is the shared shaping/discovery layer. Prefer adding new forum ranking or social logic there instead of scattering it across controllers.
- `Thread.media` is still preserved for backward compatibility. New work should prefer `mediaItems`.
- Public forum read endpoints use optional auth so read responses can include viewer-specific state like `isLiked` and `isFollowing`.
