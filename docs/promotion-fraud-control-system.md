# Promotion Fraud Control System

## Purpose

This document captures the fraud-control design and implementation that now protects the current MarketSpase promotion model from abusive promoter traffic.

It is meant for developers and operators who need to understand:

- which loopholes are applicable to the current PPC/PPL-style system
- how suspicious traffic is detected
- how warnings, 1-hour link holds, and temporary 2-hour suspensions are enforced
- how admins review and administer fraud cases
- which parts are complete now versus intentionally deferred

## Current model context

The live promotion model centers on:

- campaign acceptance by promoters
- generated promotion links with a unique `upi`
- click tracking at the campaign tracking endpoint
- marketer charging and promoter earnings on valid traffic
- promoter-facing sharing flows inside the platform app

Because the current implementation is traffic-first, the most dangerous fraud vectors are the ones that can fake or cheaply inflate tracked traffic.

## Loopholes reviewed

### Applicable to the current implementation

These loopholes directly apply to the current promotion flow and are now part of the fraud-control system:

- fake clicks
- self-click fraud
- self-referral traffic on promotion links
- bot traffic
- click farms / reciprocal click rings
- incentivized spam traffic
- direct acceptance of campaigns that a promoter does not qualify for
- unauthorized access to proof details

### Not fully solved in this pass

These were reviewed but are not fully enforceable yet because the live system does not yet have the right data pipeline:

- fake leads
- full lead-quality validation
- sales fraud on post-purchase conversion models
- AI-edited screenshot fraud for legacy proof workflows
- full multi-account identity linkage by payout account / national identity

Those remain future-phase work and should not be represented as already solved.

## High-level system behavior

### First suspicious event

When a promotion link starts showing suspicious traffic:

1. the suspicious click is marked invalid
2. the marketer is not charged
3. the promoter is not credited
4. the promotion link is paused
5. the fraud hold on that link is set for 1 hour
6. the promoter receives a warning email
7. the promoter also receives an in-app warning
8. the fraud case becomes visible in admin monitoring

### Repeat suspicious behavior

If the promoter continues and a new enforceable fraud event is detected:

1. the promoter receives a final suspension email
2. the promoter account is set inactive for 2 hours
3. all active promotion links for that promoter are disabled
4. each affected link gets a 1-hour fraud hold window
5. the fraud case is marked suspended
6. admin monitoring reflects the suspension immediately

## Architecture overview

### Detection entry point

Primary tracking file:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\controllers\track-campaign-click.controller.js`

The tracking endpoint now performs fraud scoring before a click can become billable.

### Fraud evaluation service

Core service:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\services\fraud\promotion-fraud.service.js`

This service is responsible for:

- evaluating click fraud signals
- creating or updating fraud cases
- pausing promotion links
- warning promoters
- suspending repeat offenders
- exposing summary and review data for admins

### Authentication fingerprint support

Supporting middleware:

- `C:\Projects\marketspase-workspace\marketspase-api\src\shared\middleware\auth.middleware.js`

The auth middleware now stores lightweight recent login fingerprints used for fraud correlation:

- hashed IP
- hashed user-agent
- device type
- last authenticated time

This allows the platform to detect when promotion traffic matches the promoter's own recent authenticated session.

## Detection model

### Signals used now

The system currently scores fraud from the following signals:

- promotion IP repetition within 24 hours
- promotion IP + user-agent repetition within 6 hours
- promoter-wide IP repetition within 24 hours
- short burst volume within 10 minutes
- too many distinct promoters sharing the same IP in a short window
- user-agent matching known automation clients
- suspicious source / referrer patterns
- click fingerprint matching the promoter's recent authenticated session
- direct use of `redirect=false`
- unhealthy recent click mix, such as too many duplicate or invalid events

### Important enforcement rule

Fraud scoring happens before payout and before marketer billing.

That means suspicious clicks are rejected at the economic decision point, not after the system has already credited the promoter.

## Applicable loopholes and how they are addressed

### 1. Fake clicks

Handled by:

- IP and user-agent repetition checks
- burst detection
- duplicate / invalid click ratio checks
- no credit or marketer charge on blocked clicks

### 2. Self-click fraud

Handled by:

- promoter auth fingerprint matching
- recent login IP matching
- repeated same-device / same-network scoring
- promotion pause on enforceable suspicion

### 3. Bot traffic

Handled by:

- known bot user-agent pattern scoring
- suspicious source pattern scoring
- invalidation before payout

Note:

There is not yet a dedicated CAPTCHA or browser-behavior telemetry layer on the tracking path. This is still a server-side detection pass, not a full browser-attestation system.

### 4. Incentivized spam / click-farm traffic

Handled by:

- suspicious source pattern scoring
- burst analysis
- cross-promoter shared-IP analysis
- repeat-warning escalation

### 5. Campaign acceptance bypass

Handled by:

- server-side targeting re-check during campaign acceptance

Primary files:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\controllers\accept-campaign.controller.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\services\campaign-targeting-eligibility.service.js`

Promoters can no longer rely on client-side discovery filtering alone. Acceptance now re-validates eligibility.

### 6. Proof snooping

Handled by:

- proof-detail authorization checks

Primary file:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\controllers\get-proof-details.controller.js`

Only admins, the campaign owner, or the owning promoter can see proof details now.

## Data model changes

### Promotion fraud state

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\models\promotion.schema.js`

Added `fraudStatus` on promotions with:

- `isFlagged`
- `reviewStatus`
- `riskLevel`
- `reasonSummary`
- `reasons`
- `warningCount`
- `firstFlaggedAt`
- `lastFlaggedAt`
- `blockedAt`
- `blockedUntil`
- `autoRestoredAt`
- `lastCaseId`

Also important:

- `promotion.isActive` is now the main link-availability switch

If `isActive` is `false`, the promotion link is considered unavailable.

### User fraud profile

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\user\models\user\schemas\fraudProfile.schema.js`

Added:

- `trustScore`
- `riskLevel`
- `warningCount`
- `strikeCount`
- `activeCaseCount`
- `lastFlaggedAt`
- `lastWarningAt`
- `lastFinalWarningAt`
- `suspendedUntil`
- `suspensionReason`
- `latestCase`
- `suspensionHistory`

### User security profile

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\user\models\user\schemas\securityProfile.schema.js`

Used for recent auth fingerprint correlation.

### Fraud case collection

File:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\models\promotion-fraud-case.model.js`

This stores:

- promoter
- marketer
- promotion
- campaign
- status
- risk level
- risk score
- detection types
- reason list
- evidence snapshot
- admin action log
- warning timestamps
- suspension timestamps
- review notes

## Warning and suspension flow

### Warning stage

When a fraud event crosses the block threshold for a promoter who has not already been warned:

- the promotion link is paused
- a 1-hour fraud hold is placed on the link
- the case status becomes `warning_sent`
- promoter trust is reduced
- promoter warning count increases
- warning email is sent
- in-app warning notification is sent

### Suspension stage

When a promoter is already warned and a new enforceable fraud event is detected:

- the case status becomes `suspended`
- the promoter account is set `isActive = false`
- `fraudProfile.suspendedUntil` is set for 2 hours
- all active promotions for the promoter are disabled
- each affected promotion keeps a 1-hour fraud hold window recorded in `fraudStatus.blockedUntil`
- final warning / suspension email is sent
- in-app suspension notification is sent

### Automatic reactivation support

The auth middleware now checks suspension windows. If the suspension date has passed, the user can be reactivated automatically on a future authenticated request.

This behavior is in:

- `C:\Projects\marketspase-workspace\marketspase-api\src\shared\middleware\auth.middleware.js`

### Automatic fraud-hold release

Promotion links that were paused by fraud enforcement are automatically released from the fraud hold after 1 hour on the next relevant platform request. The release is recorded in both the promotion activity log and the fraud case action log so admins can still review the full pattern later.

This behavior is handled in:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\services\fraud\promotion-fraud.service.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\controllers\track-campaign-click.controller.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\controllers\get-a-user-promotion.controller.js`

## Admin monitoring and administration

### Admin API surface

Routes added under promotion admin operations:

- `GET /api/v1/promotion/admin/fraud/summary`
- `GET /api/v1/promotion/admin/fraud/cases`
- `POST /api/v1/promotion/admin/fraud/cases/:caseId/action`

Primary route file:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\routes\promotion.route.js`

Controller files:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\controllers\admin\get-promotion-fraud-summary.controller.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\controllers\admin\get-promotion-fraud-cases.controller.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\controllers\admin\apply-promotion-fraud-action.controller.js`

### Admin dashboard notification strategy

There is not a separate admin notification model wired for per-admin in-app fraud alerts.

Instead, fraud alerts are surfaced operationally through:

- a fraud pulse endpoint
- a fraud monitor entry in the admin shell
- a dedicated fraud monitor page

Fraud pulse route:

- `GET /api/v1/dashboard/stats/fraud-pulse`

Route file:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\dashboard\routes\stats.route.js`

### Admin frontend monitor

Main admin monitor page:

- `C:\Projects\marketspase-workspace\marketspase\projects\admin\src\app\promotion\promotion-fraud-monitor\promotion-fraud-monitor.component.ts`
- `C:\Projects\marketspase-workspace\marketspase\projects\admin\src\app\promotion\promotion-fraud-monitor\promotion-fraud-monitor.component.html`
- `C:\Projects\marketspase-workspace\marketspase\projects\admin\src\app\promotion\promotion-fraud-monitor\promotion-fraud-monitor.component.scss`

Route:

- `/dashboard/promotions/fraud`

Admin actions supported:

- suspend promoter for 2 hours
- restore promotion link
- mark case resolved
- dismiss case

### Admin shell integration

Files:

- `C:\Projects\marketspase-workspace\marketspase\projects\admin\src\app\dashboard\index.component.ts`
- `C:\Projects\marketspase-workspace\marketspase\projects\admin\src\app\dashboard\index.component.html`
- `C:\Projects\marketspase-workspace\marketspase\projects\admin\src\app\dashboard\dashboard-main.component.ts`
- `C:\Projects\marketspase-workspace\marketspase\projects\admin\src\app\dashboard\dashboard-main.component.html`

The admin dashboard now exposes:

- fraud pulse count in the header
- direct navigation to the fraud monitor
- overview panel for fraud review
- detailed fraud history including warnings, strikes, suspension history, link hold timing, and action history

## Promoter-facing behavior

The promoter UI now respects paused / blocked promotion state.

Primary files:

- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\promoter\promotion\components\promotion-card\promotion-card.component.ts`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\promoter\promotion\components\promotion-card\promotion-card.component.html`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\promoter\promotion\promotion-details\promotion-detail.component.ts`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\promoter\promotion\promotion-details\promotion-detail.component.html`
- `C:\Projects\marketspase-workspace\marketspase\projects\platform\src\app\promoter\promotion\promotion-details\components\promotion-footer\promotion-footer.component.ts`

Promoters now see:

- a clear restriction banner
- blocked share / copy actions for paused links
- disabled open-link actions for restricted promotions

This keeps the UI consistent with backend enforcement.

## Fraud thresholds and tuning

Current fraud tuning is environment-driven through these variables:

- `PROMOTION_FRAUD_SUSPENSION_HOURS`
- `PROMOTION_FRAUD_LINK_HOLD_HOURS`
- `PROMOTION_FRAUD_MAX_IP_PROMOTION_24H`
- `PROMOTION_FRAUD_MAX_IP_UA_PROMOTION_6H`
- `PROMOTION_FRAUD_MAX_IP_PROMOTER_24H`
- `PROMOTION_FRAUD_MAX_DISTINCT_PROMOTERS_PER_IP_24H`
- `PROMOTION_FRAUD_BURST_LIMIT_10M`
- `PROMOTION_FRAUD_BLOCK_SCORE`

These are defined in:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\services\fraud\promotion-fraud.service.js`

Recommendation:

Do not treat the current thresholds as final. Tune them using real production patterns after monitoring:

- false positives
- fraud escape rate
- promoter complaint rate
- marketer traffic quality feedback

## Known limitations

### 1. Lead fraud is not fully solved yet

The current pass does not introduce:

- OTP-backed lead verification
- duplicate-lead suppression
- marketer lead-quality adjudication workflow

Campaigns with `campaignGoal = "leads"` still need a dedicated verified-lead subsystem if the platform wants strong PPL enforcement.

### 2. No dedicated browser attestation layer yet

There is no client-side behavioral telemetry such as:

- scroll depth
- pointer activity
- trusted browser event sequences
- CAPTCHA challenge path

The current system is strong enough to block obvious low-quality traffic, but it is not a full anti-bot browser trust platform.

### 3. No payout-identity graph yet

Multi-account abuse by:

- shared payout accounts
- shared national identity
- deep device graph linkage

is not fully implemented in this pass.

## Recommended next phase

If the platform wants the next level of fraud hardening, the most valuable follow-up work is:

1. verified lead pipeline for lead campaigns
2. marketer complaint and spam-report workflow tied to fraud cases
3. deeper device / payout identity graphing
4. optional CAPTCHA or browser challenge path for suspicious traffic
5. manual case creation from admin for off-platform complaints

## Verification completed during implementation

Backend:

- `node --check C:\Projects\marketspase-workspace\marketspase-api\src\shared\middleware\auth.middleware.js`
- `node --check C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\controllers\track-campaign-click.controller.js`
- `node --check C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\controllers\accept-campaign.controller.js`
- `node --check C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\controllers\get-proof-details.controller.js`
- `node --check C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\services\campaign-targeting-eligibility.service.js`
- `node --check C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\services\fraud\promotion-fraud.service.js`

Frontend:

- `npx.cmd tsc -p C:\Projects\marketspase-workspace\marketspase\projects\admin\tsconfig.app.json --noEmit`
- `npx.cmd ng build admin --configuration development`
- `npx.cmd tsc -p C:\Projects\marketspase-workspace\marketspase\projects\platform\tsconfig.app.json --noEmit`
- `npx.cmd ng build platform --configuration development`

## Rollout checklist

1. deploy `marketspase-api`
2. deploy `admin`
3. deploy `platform`
4. confirm fraud monitor route is reachable in admin
5. confirm a paused promotion cannot still be shared from promoter UI
6. monitor fraud pulse and case creation on first live traffic
7. tune fraud threshold environment variables after observing live patterns

## Summary

This fraud-control system turns the current promotion model from a trust-heavy click-credit flow into a gated system with:

- server-side fraud scoring
- no-credit / no-charge invalidation
- automatic warning escalation
- promotion link shutdown
- 1-hour automatic link hold release with audit history
- 2-hour promoter suspension for repeat offenders
- admin monitoring and manual review controls

It materially improves platform trust for marketers while leaving room for a future verified-lead and deeper identity-trust layer.
