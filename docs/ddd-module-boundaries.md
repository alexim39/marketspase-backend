# MarketSpase Backend Module Boundaries (MVC -> DDD)

This document is a living inventory of backend modules, their responsibilities, and the intended DDD layer split.

It is written to support **incremental migration**: we keep existing MVC routes stable while moving one bounded use
case at a time behind an application service + domain rules + repositories.

## Conventions Used In This Doc

- **Domain**: business concepts, invariants, policies, and rules (no Express, no Mongoose).
- **Application**: orchestrates use-cases, transactions, authorization, and coordination between aggregates.
- **Infrastructure**: persistence (Mongoose), external gateways (Paystack, Cloudinary, Firebase), background jobs.
- **Interface (HTTP)**: controllers/routes/middleware that translate HTTP requests into application calls.

## Module Index

The codebase modules live under `src/apps/*`.

| Module | Boundary / responsibility | Primary aggregates (target) | Key external dependencies |
| --- | --- | --- | --- |
| `auth` | Identity verification, login provisioning, provider sync | `AuthIdentity`, `UserAuthProfile` | Firebase, User repo |
| `user` | User profiles, admin user ops, activity, reputation | `User` | Mongoose |
| `campaign` | PPC campaigns: lifecycle, targeting, analytics, top-ups, click tracking | `Campaign` | Mongoose, Promotion, Wallet |
| `promotion` | Promoter participation in campaigns, fraud rules, lifecycle | `Promotion` | Mongoose, Campaign, Notification |
| `wallet` | Balances, ledger movements, deposits/withdrawals, webhooks | `Wallet`, `LedgerEntry` | Paystack, Mongoose |
| `store` | Stores, products, orders, affiliate attribution | `Order`, `Store`, `Product` | Mongoose, payments |
| `notification` | In-app notifications, scheduled jobs | `Notification` | Mongoose, cron |
| `financial` | Refunds, transfers, admin finance reports | `Refund`, `TransferReport` | Mongoose |
| `search` | Search indexing + query | `SearchIndex` | Mongo, in-memory index |
| `feeds` | Social feed composition and delivery | `FeedItem` | Mongoose |
| `forum` | Threads, comments, social discussion | `Thread`, `Comment` | Mongoose |
| `contact` | Contact messages + exports | `ContactMessage` | Mongoose |
| `dashboard` | Cross-module admin/user summaries | (read models) | Mongoose |
| `settings` | Admin/user settings, payment settings | `Settings` | Mongoose |
| `newsletter` | Newsletter campaigns + subscribers | `NewsletterCampaign` | email provider |
| `tutorial` | Tutorial content + views | `Tutorial` | Mongoose |
| `profile` | Public profile presentation & social graph projection | `ProfileView` (read model) | Mongoose |
| `collaboration` | Collaboration requests + reviews | `Collaboration` | Mongoose |
| `metrics` | Platform metrics + dashboards | `Metric` | Mongoose |
| `ai-assistant` | Assistant APIs + repository flows | `AssistantThread` | OpenAI, Mongoose |
| `streaks` | Daily login streak rules | `LoginStreak` | Mongoose |
| `gamification` | Gamification progress/events | `GamificationEvent` | Mongoose |
| `badges` | Badge progression + levels | `BadgeProfile` | Mongoose |

## Per-Module Notes (What Lives Where)

### `auth`

- MVC today: controllers verify tokens, sync provider profiles, create users, etc.
- DDD target:
  - Domain: provider profile normalization, reconciliation rules, auth identity policies.
  - Application: `AuthenticateUserUseCase`, `GetUserProfileUseCase`.
  - Infrastructure: Firebase verification gateway + Mongoose user repository.

### `user`

- Boundary: profile edits, user administration, reputation calculations, activity log.
- DDD target:
  - Domain: user state transitions, reputation rules (rating aggregation policy).
  - Application: `UpdateUserProfile`, `BanUser`, `RefreshReputation`.
  - Infrastructure: Mongoose persistence + background jobs for rollups.

### `campaign`

- Boundary: marketer-owned PPC campaigns and their runtime lifecycle.
- DDD target:
  - Domain: `Campaign` (budgeting rules, status transitions, targeting policy).
  - Application: `CreateCampaign`, `ApproveCampaign`, `TopUpCampaign`, `PauseCampaign`, `TrackClick`.
  - Infrastructure: Mongoose repositories; background scheduler jobs; promotion activation toggles.

### `promotion`

- Boundary: promoter participation in campaigns, fraud detection and enforcement.
- DDD target:
  - Domain: `Promotion` state machine, fraud policies, payout model constraints.
  - Application: `AcceptCampaign`, `SuspendPromoter`, `AutoRejectLegacyPromotion` (legacy only).
  - Infrastructure: Mongoose repositories, scheduled jobs, notifications.

### `wallet`

- Boundary: wallet balances and transfers (marketer/promoter), payment webhooks, withdrawal approvals.
- DDD target:
  - Domain: ledger invariants (no negative balance, idempotency keys), transaction types.
  - Application: `MoveWithinWallet`, `MoveBetweenWallets`, `ProcessDepositWebhook`, `RequestWithdrawal`.
  - Infrastructure: Paystack gateways + Mongoose ledger repositories + cron reconciliation.

### `store`

- Boundary: ecommerce operations (orders) and promoter attribution for conversions.
- DDD target:
  - Domain: order state machine, payment settlement policy, attribution rules.
  - Application: `CreateOrder`, `MarkOrderPaid`, `RefundOrder`, `AttributePromoterConversion`.
  - Infrastructure: Mongoose repositories and payment gateways.

### `notification`

- Boundary: notification creation + scheduled jobs.
- DDD target:
  - Domain: notification templates, priority rules, dedupe policies.
  - Application: `CreateNotification`, `ScheduleNotificationJobs`.
  - Infrastructure: cron and Mongoose persistence.

### Remaining Modules

For the smaller modules (`contact`, `newsletter`, `tutorial`, etc.), we keep migration conservative:
- prefer read-model/query services first (reduce controller logic)
- introduce repositories only when a use-case needs to evolve safely
- defer deep refactors until there is automated test coverage for that module

