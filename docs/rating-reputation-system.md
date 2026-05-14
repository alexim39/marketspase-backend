# MarketSpase Rating and Reputation System

## Overview

MarketSpase now uses two distinct but connected scoring layers:

1. **Product ratings and reviews**
   - Customer-facing
   - Stored per storefront product review
   - Drives product `averageRating`, `ratingCount`, store review analytics, storefront sorting, and review UI

2. **User reputation**
   - Platform-facing trust score for marketers and promoters
   - Persisted in `user.rating` and `user.ratingCount`
   - Used for profile reputation, campaign targeting (`minRating`), promoter summaries, feed discovery, and admin trust views

This separation avoids mixing customer product reviews with account-level trust.

## Data Model

### Product reviews

Primary model:
- `src/apps/store/models/review/review.schema.js`

Important fields:
- `productId`
- `storeId`
- `userId`
- `rating`
- `title`
- `comment`
- `status`
- `verifiedPurchase`
- `helpfulCount`
- `response`

Aggregated values written back to products:
- `product.averageRating`
- `product.ratingCount`

Derived store analytics are merged at response time rather than stored permanently.

### User reputation

Primary user fields:
- `user.rating`
- `user.ratingCount`

Reputation engine:
- `src/apps/user/services/user-reputation.service.js`

`ratingCount` now represents the number of trust signals contributing to the reputation snapshot, not literal star reviews from other users.

## Backend Services

### Review aggregation

File:
- `src/apps/store/services/review-aggregate.service.js`

Responsibilities:
- calculate product review summary
- sync product rating aggregates
- calculate store review summary
- merge rating analytics into storefront/store responses

### User reputation engine

File:
- `src/apps/user/services/user-reputation.service.js`

Responsibilities:
- collect cross-app signals from campaigns, promotions, storefront sales, reviews, followers, community activity, streaks, and gamification
- calculate a bounded 0-5 reputation score
- persist refreshed values back to the user document

## APIs

### Product review APIs

Routes live in:
- `src/apps/store/routes/storefront/storefront.routes.js`

Endpoints:
- `GET /stores/storefront/products/:productId/reviews`
- `GET /stores/storefront/products/:productId/reviews/me`
- `POST /stores/storefront/products/:productId/reviews`
- `PUT /stores/storefront/reviews/:reviewId`
- `DELETE /stores/storefront/reviews/:reviewId`
- `POST /stores/storefront/reviews/:reviewId/helpful`
- `POST /stores/storefront/reviews/:reviewId/report`

Behavior:
- write actions require auth
- verified purchases are detected from paid storefront orders
- verified-purchase reviews can be auto-approved
- otherwise reviews may remain pending depending on store rules

### Reputation refresh touchpoints

Current reputation refresh points:
- `GET /auth/:uid`
- profile fetch in `src/apps/profile/controllers/user.controller.js`
- campaign eligibility filtering in `src/apps/campaign/controllers/get-by-status-and-userid.controller.js`

These ensure the app surfaces current reputation without needing a manual backfill job.

## Frontend Flows

### Storefront review flow

Main files:
- `projects/platform/src/app/storefront/services/storefront.service.ts`
- `projects/platform/src/app/storefront/product-details/main/product-details.component.ts`
- `projects/platform/src/app/storefront/product-details/main/components/product-reviews/product-reviews.component.ts`
- `projects/platform/src/app/storefront/product-details/main/components/write-review-dialog.component.ts`

Flow:
1. Product page loads review summary and paginated reviews
2. Signed-in user fetches their own review state
3. User can create, update, delete, mark helpful, or report
4. Review summary and product/store analytics refresh after mutation

### Reputation surfaces

Current live surfaces include:
- profile page
- promoter landing summary
- campaign requirements and targeting displays
- admin trust/reputation views

UI language now uses **Reputation** where the value comes from `user.rating`.

## Admin Notes

Admin views still consume engagement fields named `averageRating` and `totalRatings` in some response contracts for compatibility, but the UI labels now treat them as:
- `Average Reputation`
- `Total Signals`

If these contracts are cleaned up later, coordinate frontend and backend renames together.

## Operational Guidance

### Safe extension points

To add new reputation inputs:
1. update `user-reputation.service.js`
2. keep weights bounded and role-aware
3. avoid pulling heavy collections without aggregation
4. preserve the 0-5 output contract unless all consumers are updated

To add new review moderation behavior:
1. extend `product-review.controller.js`
2. keep `syncProductReviewStats` as the single source for product aggregate refresh

### Things to avoid

- Do not use testimonials as direct user reputation input
- Do not mix product review counts with promoter/marketer trust counts
- Do not rename `minRating` at the API layer without a coordinated migration

## Verification Checklist

After rating-related changes, verify:
- storefront review create/update/delete
- helpful toggle
- product average rating refresh
- store header rating refresh
- authenticated user fetch returns updated `rating` and `ratingCount`
- promoter landing and profile show the same reputation number
- campaign minimum reputation targeting still filters correctly
