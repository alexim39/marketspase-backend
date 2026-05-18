# Global Search System

## Purpose

This document describes the global search feature added to the live MarketSpase stack. The goal is to provide a fast, role-aware, paginated search experience across core entities without introducing risky changes to the live production architecture.

Instead of introducing a brand new external search cluster in the same rollout window, the implementation uses a dedicated denormalized Mongo-backed search index. This gives MarketSpase an Elasticsearch-like indexed search layer while staying inside the existing deployment model.

## Scope

Global search currently indexes:

- users
- campaigns
- promotions
- products
- stores

The search layer is exposed through authenticated API routes and consumed by the platform dashboard shell.

## Architecture

### Search index collection

New indexed collection:

- `SearchDocument`

Source files:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\search\models\search-document.schema.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\search\models\search-document.indexes.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\search\models\search-document.model.js`

### Search document shape

Each search record stores denormalized fields needed for ranking, filtering, and navigation:

- `entityType`
- `entityId`
- `title`
- `subtitle`
- `description`
- `normalizedTitle`
- `normalizedSubtitle`
- `normalizedDescription`
- `keywords`
- `searchTerms`
- `searchPrefixes`
- `region`
- `status`
- `userType`
- `ownerId`
- `relatedOwnerId`
- `storeId`
- `relatedCampaignId`
- `primaryImage`
- `visibility`
- `isActive`
- `isDeleted`
- `metadata`
- `createdAt`
- `updatedAt`

### Index strategy

The search collection uses a mix of exact, prefix, facet, and text indexes:

- unique index on `(entityType, entityId)`
- owner-scoped indexes for restricted result retrieval
- active/status/entityType indexes for filtered searches
- multikey indexes on `searchTerms` and `searchPrefixes`
- region indexes for location filters
- weighted text index across `title`, `subtitle`, `description`, and `keywords`

This keeps search performant as entity counts grow and supports both full result pages and lightweight suggestions.

## Backend services

Core files:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\search\services\search.utils.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\search\services\search-index.service.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\search\controllers\search.controller.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\search\routes\search.routes.js`

### Main responsibilities

`search-index.service.js` handles:

- denormalizing source entities into search documents
- indexing users, campaigns, promotions, products, and stores
- background bootstrap reindex when the search collection is empty
- per-entity sync on model writes
- role-aware visibility enforcement
- relevance scoring
- pagination and facet generation
- navigation path generation for frontend results

### Ranking model

Results are ranked with a composite score built from:

- exact title match
- prefix title match
- title contains query
- subtitle contains query
- description contains query
- token intersection with `searchTerms`
- prefix intersection with `searchPrefixes`
- active-status bias

This keeps the closest results near the top while still allowing broad partial matches.

## API surface

Mounted route:

- `app.use('/api/v1/search', SearchRouter);`

### `GET /api/v1/search`

Returns paginated full results.

Supported query params:

- `q`
- `types`
- `userTypes`
- `statuses`
- `region`
- `page`
- `limit`

Response shape:

- `success`
- `data.query`
- `data.pagination`
- `data.results`
- `data.facets`

### `GET /api/v1/search/suggestions`

Returns lightweight real-time suggestions for the global search bar.

Supported query params:

- `q`
- `types`
- `userTypes`
- `statuses`
- `region`
- `limit`

### `POST /api/v1/search/admin/reindex`

Admin-only maintenance endpoint.

Purpose:

- rebuild the whole search index
- rebuild only selected entity types

Optional body/query:

- `entityTypes=user,campaign,...`

## Security model

All search routes require authentication through:

- `authenticate`

Admin-only reindex additionally requires:

- `requireAdmin`

Visibility is enforced at query time, not only at index time.

### Visibility rules

Admins can inspect all non-deleted indexed entities.

Marketers can see:

- their own campaigns
- their own promotions or promotions tied to their campaigns
- their own stores and products
- public active stores and published products

Promoters can see:

- active campaigns
- their own promotions
- public active stores and published products

General users only see public or active-safe entities appropriate for their role context.

This prevents restricted promotions, private business assets, or admin-only records from leaking through search.

## Sync model

Search documents are updated asynchronously from existing model middleware.

Patched middleware files:

- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\user\models\user\user.middleware.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\campaign\models\campaign.middleware.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\promotion\models\promotion.middleware.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\store\models\promotion\product\product.middleware.js`
- `C:\Projects\marketspase-workspace\marketspase-api\src\apps\store\models\store\store.middleware.js`

Supported sync events:

- `save`
- `findOneAndUpdate`
- `updateOne`
- `findOneAndDelete`

This design avoids invasive writes inside controllers and keeps search synchronization close to the data source.

## Deployment and bootstrap

Startup integration:

- `C:\Projects\marketspase-workspace\marketspase-api\server.js`

On boot:

- the search router is mounted
- a background bootstrap checks whether the search index is empty
- if empty, a full reindex is started asynchronously

This keeps startup non-blocking while ensuring new environments become searchable without manual intervention.

## Performance notes

- results are paginated server-side
- filters are applied before sorting/faceting where possible
- entity search documents are denormalized to avoid expensive live cross-collection joins during search
- autocomplete suggestions reuse the same index with a smaller limit
- `allowDiskUse(true)` is enabled for the aggregation pipeline to stay safe on larger datasets

## Future scaling path

If MarketSpase outgrows the Mongo-backed index, the current document builder model can be reused to feed Elasticsearch, OpenSearch, Meilisearch, or Typesense later.

The easiest migration path would be:

1. keep `buildDocumentFromEntity`
2. swap `SearchDocumentModel` writes for external search writes
3. preserve the same API contract for the frontend

That means this rollout is intentionally compatible with a later dedicated search engine upgrade.

## Verification completed

Completed locally:

- `node --check C:\Projects\marketspase-workspace\marketspase-api\server.js`
- `node --check C:\Projects\marketspase-workspace\marketspase-api\src\apps\search\controllers\search.controller.js`
- `node --check C:\Projects\marketspase-workspace\marketspase-api\src\apps\search\routes\search.routes.js`
- `node --check C:\Projects\marketspase-workspace\marketspase-api\src\apps\search\services\search-index.service.js`

Recommended post-deploy checks:

1. hit `GET /api/v1/search?q=test`
2. confirm role-specific restricted results stay hidden
3. run one admin reindex in staging
4. inspect search latency with production-like data volumes
5. confirm entity updates appear in search after create/edit/delete flows

## Maintenance notes

- If a new searchable entity is added, implement:
  - a document builder
  - an entity fetcher
  - a visibility rule
  - a navigation resolver
  - middleware sync hooks
- Keep metadata small and purposeful; avoid storing full hydrated records.
- If search quality needs tuning, adjust ranking weights in `queryGlobalSearch()` rather than changing the API contract first.
