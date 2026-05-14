# Admin User Analytics

## Purpose

This analytics surface gives admins a live view of MarketSpase users by:

- role
- country
- state
- gender
- age band
- activity recency
- profile completeness
- streak segment
- gamification level
- signup trend
- referral-heavy markets

It is designed for decision-making rather than raw user CRUD.

## Backend

### Endpoint

- `GET /api/v1/user/admin/users/analytics`

### Auth

- requires authenticated admin access
- protected by the existing `authenticate` + `requireAdmin` chain through the user admin router

### Query params

- `role=all|marketer|promoter|admin`
- `windowDays=30|90|180|365|...`
- `top=5..20`
- `months=3..24`

### Response sections

- `filters`
- `summary`
- `distributions.roles`
- `distributions.countries`
- `distributions.states`
- `distributions.genders`
- `distributions.ages`
- `distributions.activity`
- `distributions.profileCompletion`
- `distributions.streaks`
- `distributions.levels`
- `distributions.monthlySignups`
- `distributions.referralRegions`
- `insights`
- `generatedAt`

### Notes

- geography primarily uses `personalInfo.address.country/state`
- country falls back to `personalInfo.phoneDetails.iso2` when address country is missing
- age is derived from `personalInfo.dob`
- profile completeness is based on phone, address, dob, gender, biography, avatar, headline, brand summary, and linked socials
- the endpoint returns aggregate analytics only; it does not expose user-level PII beyond the grouped dimensions

## Frontend

### Admin route

- `/dashboard/users/analytics`

### Main files

- `marketspase/projects/admin/src/app/users/analytics/user-analytics.component.ts`
- `marketspase/projects/admin/src/app/users/analytics/user-analytics.component.html`
- `marketspase/projects/admin/src/app/users/analytics/user-analytics.component.scss`
- `marketspase/projects/admin/src/app/users/analytics/user-analytics.service.ts`

### Navigation

- available from the admin sidebar under `Users -> User Analytics`
- linked from the main user management page header

## Versioning

This feature uses the versioned path:

- `/api/v1/user/...`

The backend keeps legacy `/user/...` mounting in place for older callers, while admin user management now points to the versioned route tree.
