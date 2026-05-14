# Admin financial analytics

## What this adds

The admin app now has a dedicated finance analytics page at:

- `/dashboard/financial/analytics`

It complements the operational finance screen at:

- `/dashboard/financial`

## Backend endpoints

The finance router is now available on both:

- `/financial`
- `/api/v1/financial`

Key endpoints used by the admin app:

- `GET /api/v1/financial/overview`
- `GET /api/v1/financial/stats`
- `GET /api/v1/financial/analytics`
- `GET /api/v1/financial/transactions`
- `GET /api/v1/financial/withdrawals`

All routes stay behind admin authentication and authorization.

## Reporting sources

Finance analytics is built from two sources:

1. Embedded wallet transactions on user wallets
   - `wallets.marketer.transactions`
   - `wallets.promoter.transactions`

2. Storefront orders
   - `OrderModel`

Wallet transactions are flattened into a reporting stream by:

- `src/apps/financial/services/financial-analytics.service.js`

## Metrics now exposed

### Summary

- total cash in
- total cash out
- net cash flow
- wallet funding
- storefront paid volume
- platform revenue proxy
- campaign spend
- promoter payouts
- available balance
- reserved balance
- withdrawal queue totals

### Trends

- monthly cash flow for selected year
- yearly cash flow over rolling trend window

### Breakdowns

- income categories
- expense categories
- withdrawal status mix
- transaction status mix
- currency activity mix

### Commerce

- total orders
- paid orders
- paid order volume
- average order value
- guest vs registered order mix
- held escrow
- released escrow
- promoter commission exposure

## Important reporting caveats

- Reporting amounts are normalized to the platform base currency when conversion metadata is available.
- Storefront refund volume reflects fully refunded orders. Partial refund amounts may be understated if the exact partial value was not stored separately.
- Campaign spend and promoter payouts are shown as operational demand/supply metrics, not audited accounting statements.

## Frontend files

- `projects/admin/src/app/financial/analytics/financial-analytics.component.ts`
- `projects/admin/src/app/financial/analytics/financial-analytics.component.html`
- `projects/admin/src/app/financial/analytics/financial-analytics.component.scss`
- `projects/admin/src/app/financial/financial.service.ts`

## Operational alignment

The older finance operations page now:

- uses versioned finance endpoints
- shows real top-line finance stats
- links directly to analytics
- loads real transaction rows instead of a placeholder stub
