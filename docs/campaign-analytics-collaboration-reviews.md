# Campaign Analytics, Collaboration, and Review System

## Summary

This implementation adds three connected capabilities to the live MarketSpase stack:

- role-aware campaign analytics for marketers and promoters
- in-app collaboration messaging tied to campaigns and promotions
- a moderated collaboration review and rating system for marketers and promoters

The work is intentionally aligned with the live PPC campaign model already in the app.

## Scope and design choices

### Analytics metrics

The dashboard uses the metrics the current campaign engine actually records consistently:

- tracked visits
- billable clicks
- invalid clicks
- duplicate clicks
- spend
- promoter earnings
- remaining budget
- active campaigns
- active promotions
- active promoters
- device breakdown
- source breakdown

Important note:

- the live campaign engine does not yet record universal ad-view impressions
- it also does not yet record universal cross-campaign conversions

Because of that, this implementation does **not** invent synthetic impression or conversion numbers. Instead, it uses tracked visits as the top-of-funnel metric and leaves a clean extension point for future conversion tracking.

## Backend models

### `CollaborationConversation`

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\collaboration\models\collaboration-conversation.schema.js`

Purpose:

- stores one-on-one and shared collaboration rooms

Key fields:

- `type`: `direct | campaign_room | promotion_room | context_room`
- `title`
- `participants[]`
- `campaign`
- `promotion`
- `createdBy`
- `lastMessageAt`
- `lastMessagePreview`
- `lastMessageBy`
- `metadata.entityType`
- `metadata.entityId`
- `metadata.entityLabel`
- `isArchived`
- `isActive`

Indexes:

- `{ campaign, type, isArchived }`
- `{ promotion, type, isArchived }`
- `{ participants.user, lastMessageAt }`

### `CollaborationMessage`

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\collaboration\models\collaboration-message.schema.js`

Purpose:

- stores conversation messages and read receipts

Key fields:

- `conversation`
- `sender`
- `messageType`
- `content`
- `attachments[]`
- `readBy[]`
- `editedAt`
- `deletedAt`

Indexes:

- `{ conversation, createdAt }`
- `{ conversation, readBy.user, createdAt }`

### `CollaborationReview`

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\collaboration\models\collaboration-review.schema.js`

Purpose:

- stores marketer/promoter collaboration feedback

Key fields:

- `reviewer`
- `reviewee`
- `campaign`
- `promotion`
- `relationshipType`
- `rating`
- `title`
- `comment`
- `status`
- `flagCount`
- `flags[]`
- `moderatedBy`
- `moderationNotes`
- `adminResponse`
- `publishedAt`
- `hiddenAt`

Indexes:

- unique review per `reviewer + reviewee + promotion`
- `{ reviewee, status, createdAt }`
- `{ reviewer, createdAt }`

### User rating summary fields

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\user\models\user\user.schema.js`

Added fields:

- `collaborationRating`
- `collaborationRatingCount`
- `collaborationReviewCount`

These fields are denormalized summary values refreshed from published collaboration reviews.

## Backend services and controllers

### Analytics service

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\services\campaign-analytics.service.js`

Functions:

- `getMarketerAnalyticsSnapshot(...)`
- `getPromoterAnalyticsSnapshot(...)`

Responsibilities:

- aggregates live PPC traffic by date
- groups performance by campaign
- groups marketer-side traffic by promoter
- groups promoter-side traffic by promotion
- returns device and source breakdowns

### Analytics controllers

Files:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\controllers\get-marketer-analytics.controller.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\controllers\get-promoter-analytics.controller.js`

### Collaboration access control

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\collaboration\services\collaboration-access.service.js`

Responsibilities:

- validates ObjectIds
- verifies conversation membership
- creates or reuses campaign rooms
- creates or reuses promotion rooms
- restricts direct promotion conversations to the linked marketer and promoter
- syncs campaign room participants from active promotion records

### Review service

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\collaboration\services\collaboration-review.service.js`

Responsibilities:

- checks review eligibility
- prevents self-reviews
- prevents duplicate reviews for the same promotion collaboration
- ensures reviews only happen between linked marketer/promoter pairs
- recomputes summary rating values on the reviewee user record

### Collaboration controllers

Files:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\collaboration\controllers\conversation.controller.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\collaboration\controllers\review.controller.js`

Responsibilities:

- list conversations
- create direct conversations
- open campaign rooms
- open promotion rooms
- fetch messages
- send messages
- mark messages read
- create reviews
- flag reviews
- expose moderation queue
- allow admin review actions

## API surface

### Analytics endpoints

- `GET /api/v1/campaign/analytics/marketer/:userId`
- `GET /api/v1/promotion/analytics/promoter/:userId`

Supported query params:

- `range`
- `startDate`
- `endDate`
- `campaignId`
- `promoterId`

### Collaboration endpoints

Mounted from:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\collaboration\routes\collaboration.routes.js`

Routes:

- `GET /api/v1/collaboration/conversations`
- `POST /api/v1/collaboration/conversations/direct`
- `POST /api/v1/collaboration/conversations/campaign/:campaignId`
- `POST /api/v1/collaboration/conversations/promotion/:promotionId`
- `GET /api/v1/collaboration/conversations/:conversationId/messages`
- `POST /api/v1/collaboration/conversations/:conversationId/messages`
- `PATCH /api/v1/collaboration/conversations/:conversationId/read`

### Review endpoints

- `GET /api/v1/collaboration/reviews/eligibility/:targetUserId`
- `GET /api/v1/collaboration/reviews/received/:userId`
- `GET /api/v1/collaboration/reviews/given/:userId`
- `POST /api/v1/collaboration/reviews`
- `POST /api/v1/collaboration/reviews/:reviewId/flag`

### Admin moderation endpoints

- `GET /api/v1/collaboration/admin/reviews`
- `PATCH /api/v1/collaboration/admin/reviews/:reviewId`

## Notifications and realtime

### Notification types added

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\notification\models\notification.constants.js`

Added:

- `COLLABORATION_MESSAGE`
- `REVIEW_RECEIVED`
- `REVIEW_FLAGGED`

### Notification service helpers

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\notification\services\notification.service.js`

Added helpers:

- `createCollaborationMessageNotification(...)`
- `createReviewReceivedNotification(...)`
- `createReviewFlaggedAdminNotification(...)`

### Socket integration

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\ai-assistant\socket.handler.js`

Added socket behavior:

- `join_collaboration_conversation`
- collaboration message emit support
- collaboration conversation update emit support

## Security checks

All collaboration and review APIs are protected by:

- `authenticate`

Admin moderation routes are additionally protected by:

- `requireAdmin`

Key enforcement rules:

1. only conversation participants or admins can open a conversation or fetch its messages
2. promotion-linked direct chats are restricted to the linked marketer and promoter
3. users cannot start direct conversations with themselves
4. users cannot review themselves
5. users cannot review the same promotion collaboration twice
6. reviews must map to a real marketer/promoter collaboration relationship
7. admin moderation updates are separated from public review actions

## Frontend integration summary

Canonical frontend companion note:

- `C:\Projects\marketspase-workspace\marketspase\docs\campaign-analytics-collaboration-reviews.md`

## Future customization

### If true conversion tracking is needed

Add:

- explicit conversion event model
- conversion capture endpoint
- campaign goal-aware aggregation
- marketer dashboard conversion summaries
- promoter conversion attribution summaries

Recommended future entity:

- `CampaignConversion`

Suggested fields:

- `campaign`
- `promotion`
- `promoter`
- `user`
- `conversionType`
- `value`
- `source`
- `orderId`
- `createdAt`

### If impression tracking is needed

Add:

- impression logging endpoint or SDK event
- privacy/rate-limiting controls
- dedupe strategy for sessions

### If collaboration attachments expand later

Extend:

- `attachments[]` in `CollaborationMessage`
- media upload service
- storage signing/authorization flow

### If moderation needs escalation later

Add:

- strike counts
- auto-hide thresholds
- admin assignment
- audit log for moderation decisions

## Verification

Verified during implementation:

- `node --check` for the changed backend collaboration, analytics, notification, and server files
- `npx.cmd tsc -p C:\Projects\marketspase-workspace\marketspase\projects\platform\tsconfig.app.json --noEmit`
- `npx.cmd ng build platform --configuration development`
- `npx.cmd tsc -p C:\Projects\marketspase-workspace\marketspase\projects\admin\tsconfig.app.json --noEmit`
- `npx.cmd ng build admin --configuration development`

Browser verification was partial:

- local unauthenticated routing was checked in the in-app browser
- authenticated dashboard pages could not be fully exercised in-browser in this session because no active signed-in staging/local test session was available

