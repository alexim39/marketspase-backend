# MarketSpase Backend DDD Migration Roadmap

This document records the current backend architecture shape and the live-safe migration pattern being used to move MarketSpase from MVC-heavy modules to a layered, domain-oriented design.

## Goals

- keep the live app stable while refactoring
- move business logic out of controllers and into application/domain services
- isolate Mongoose access behind repositories
- make modules easier to reason about, test, and evolve

## Current Module Inventory

The codebase is still mostly MVC or service-oriented. Only a few areas show early layered structure.

| Module | Primary responsibility | Current structure | Status | Migration priority |
| --- | --- | --- | --- | --- |
| `auth` | identity provisioning, sign-in, admin auth, user bootstrap | `controllers`, `models`, `routes`, `services` | MVC + services | High |
| `user` | user profile/admin management, promos, activity | `controllers`, `models`, `routes`, `services`, `utils` | MVC + services | High |
| `campaign` | campaign creation, approval, targeting, analytics, click tracking | `controllers`, `models`, `routes`, `services`, `utils` | MVC + services | High |
| `promotion` | promoter campaign participation, fraud checks, lifecycle jobs | `controllers`, `models`, `routes`, `services`, `utils` | MVC + services | High |
| `wallet` | deposits, withdrawals, transfers, ledgers, payment webhooks | `controllers`, `jobs`, `models`, `routes`, `services` | MVC + services | High |
| `store` | storefronts, products, orders, affiliates, public storefront APIs | `controllers`, `middleware`, `models`, `routes`, `services`, `utils` | MVC + services | High |
| `notification` | in-app notifications, scheduled reminders, accounting notices | `controllers`, `models`, `routes`, `services` | MVC + services | Medium |
| `profile` | public profile, suggestions, social graph presentation | `controllers`, `models`, `routes`, `services` | MVC + services | Medium |
| `collaboration` | conversations, reviews, collaboration access | `controllers`, `models`, `routes`, `services` | MVC + services | Medium |
| `search` | global search indexing and querying | `controllers`, `models`, `routes`, `services` | layered-ish service module | Medium |
| `forum` | threads, comments, forum discovery | `controllers`, `models`, `routes`, `services` | MVC + services | Medium |
| `contact` | contact workflows and exports | `controllers`, `models`, `routes`, `services` | MVC + services | Low |
| `dashboard` | dashboard summaries and live activity | `controllers`, `models`, `routes`, `services` | MVC + services | Low |
| `settings` | user/admin preferences and testimonials | `controllers`, `models`, `routes`, `services` | MVC + services | Low |
| `newsletter` | campaigns, delivery, subscriber handling | `controllers`, `models`, `routes`, `services` | MVC + services | Low |
| `tutorial` | tutorial content and view jobs | `controllers`, `jobs`, `models`, `routes`, `services` | MVC + services | Low |
| `feeds` | social feed discovery and notifications | `controllers`, `jobs`, `models`, `routes`, `services`, `utils` | MVC + services | Low |
| `financial` | refunds and transfer reporting | `controllers`, `models`, `routes`, `services` | MVC + services | Low |
| `metrics` | app-level reporting | `api`, `domain`, `repository`, `service`, `tests` | early layered reference | Medium |
| `ai-assistant` | assistant APIs, settings, repository-backed flows | `api`, `model`, `repository`, `service` | early layered reference | Medium |
| `streaks` | login streak rules and rewards | `api`, `models`, `service` | service-oriented | Medium |
| `gamification` | milestones and events | `api`, `models`, `service` | service-oriented | Medium |
| `badges` | badge progression | `api`, `models`, `service` | service-oriented | Medium |

## Migration Rules

1. Preserve public routes and response contracts during each step.
2. Move one feature or use case at a time, not a whole module at once.
3. Keep controllers thin:
   - parse request
   - call an application use case
   - shape the HTTP response
4. Keep business rules in domain/application code.
5. Keep persistence behind repositories.
6. Add focused regression tests for each migrated slice before widening scope.

## First Incremental Slice: `auth` -> `Authenticate`

This migration starts with the `POST /api/v1/auth` flow because it is:

- business critical
- highly bounded
- easy to validate with focused tests
- a good example of provider sync, onboarding, and repository boundaries

### Old shape

- `user-auth.controller.js` performed token verification, provider profile sync, new-user provisioning, referrals, emails, activity logging, and reputation refresh in one controller.
- Mongoose access and business rules were mixed together.

### New layered shape

#### Interface layer

- [C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\controllers\user-auth.controller.js](C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\controllers\user-auth.controller.js)
  - `Authenticate` is now an entry point that delegates to an application use case.

#### Application layer

- [C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\application\use-cases\authenticate-user.use-case.js](C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\application\use-cases\authenticate-user.use-case.js)
  - orchestrates login flow
  - decides new-user vs existing-user path
  - triggers referral, activity logging, welcome notifications, and reputation refresh

#### Domain layer

- [C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\domain\value-objects\provider-profile.js](C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\domain\value-objects\provider-profile.js)
  - normalizes provider identity data from Firebase/token/providerData

- [C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\domain\services\provider-profile-reconciliation.service.js](C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\domain\services\provider-profile-reconciliation.service.js)
  - decides which provider-managed fields can be updated
  - builds new-user drafts

#### Infrastructure layer

- [C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\infrastructure\repositories\mongoose-auth-user.repository.js](C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\infrastructure\repositories\mongoose-auth-user.repository.js)
  - encapsulates Mongoose persistence for auth user sync

- [C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\infrastructure\services\auth-activity-log.service.js](C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\infrastructure\services\auth-activity-log.service.js)
  - fail-soft activity logging

- [C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\infrastructure\services\auth-welcome-notification.service.js](C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\infrastructure\services\auth-welcome-notification.service.js)
  - welcome/admin signup emails

### Compatibility bridge

- [C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\services\provider-profile-sync.service.js](C:\Projects\marketspase-workspace\marketspase-api\src\apps\auth\services\provider-profile-sync.service.js)
  remains as a compatibility facade while older callers migrate.

## Recommended Next Slices

These are the safest high-value slices to migrate next:

1. `auth/GetUser`
   - move dashboard hydration behind a read-model query service
2. `wallet` transfer and withdrawal orchestration
   - split controllers from ledger/domain rules
3. `campaign/TopUpCampaign`
   - move top-up rules out of the controller and behind an application use case + repositories
4. `campaign` accept/create flows
   - move policy and persistence behind application services/repositories
5. `promotion` promoter dashboard reads
   - introduce query services and repositories
6. `store` product promotion creation
   - isolate affiliate/promotion rules from controllers

## Modules to Leave Alone For Now

These modules should stay mostly as-is until more tests or clearer boundaries exist:

- `contact`
- `dashboard`
- `newsletter`
- `tutorial`
- very large `storefront` public controllers

The live app matters more than architectural purity. If a module has a wide blast radius and weak automated coverage, defer it.

## Verification Standard Used For This Slice

- backend syntax checks for changed files
- targeted node tests for new auth domain/application files
- frontend platform typecheck/build when request payloads change

## Incremental Slice: `campaign` -> `TopUpCampaign`

This slice migrates `POST /api/v1/campaign/:campaignId/top-up` because it is:

- revenue-impacting (enables campaigns to resume spending safely)
- bounded (single write workflow with clear invariants)
- a good candidate to demonstrate Mongoose isolation behind repositories

### Old shape

- `top-up-campaign.controller.js` contained:
  - validation
  - auth/authorization rules
  - wallet balance checks
  - campaign mutation + reactivation side effects
  - persistence

### New layered shape

#### Interface layer

- `src/apps/campaign/controllers/top-up-campaign.controller.js`
  - parses request
  - resolves actor identity
  - delegates to the application use case

#### Application layer

- `src/apps/campaign/application/use-cases/top-up-campaign.use-case.js`
  - enforces top-up invariants
  - owns the transaction boundary
  - applies campaign reactivation rules

#### Infrastructure layer

- `src/apps/campaign/infrastructure/repositories/mongoose-campaign.repository.js`
  - encapsulates campaign persistence for this use case

- `src/apps/campaign/infrastructure/repositories/mongoose-marketer-wallet.repository.js`
  - encapsulates marketer wallet reads required for top-up validation

## Longer-Term Target Shape

Each core module should eventually converge on:

- `api/` or `controllers/entrypoints/`
- `application/use-cases/`
- `domain/entities|value-objects|services|events/`
- `infrastructure/repositories|gateways|services/`
- `tests/`

That target should be reached incrementally, not by a broad rewrite.
