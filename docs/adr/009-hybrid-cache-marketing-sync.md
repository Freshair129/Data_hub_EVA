# ADR 009: Hybrid Cache & Marketing Sync Strategy

Date: 2026-02-19

## Status

Accepted

## Context

The CRM system requires high responsiveness for UI components while maintaining data accuracy for marketing analytics and customer profiles. 
- **Latency**: Direct DB or API calls for large datasets (e.g., full customer lists or marketing insights) lead to slow page loads.
- **API Limits**: Frequent polling of the Facebook Marketing API risks hitting rate limits.
- **Data Volume**: As the number of customers and daily metrics grows, real-time aggregation becomes computationally expensive.

## Decision

We will implement a **Hybrid Cache & Marketing Sync** architecture.

### 1. Cache-First UI Pattern
- All GET requests in the CRM will prioritize reading from **Local JSON Cache** (`crm-app/cache/`).
- If a cache hit occurrs, the UI receives data instantly.
- A background refresh is triggered to sync with the Main DB/API.

### 2. Hybrid Data Synchronization
- **Bulk Sync (Scheduled)**: A Python-based worker (`marketing_sync.py`) runs hourly to fetch comprehensive marketing data and upsert into the Main DB.
- **Real-time Sync (Reactive)**: Node.js webhook handlers and API POST routes trigger targeted updates (e.g., when a lead is captured or a chat occurs).

### 3. Event-Driven Cache Invalidation
- Every Database write (via Python or Node) emits a job to a **BullMQ** queue (`cache-sync`).
- The `cacheSyncWorker.js` consumes these jobs and rewrites the relevant JSON cache files.
- This ensures the Local Cache stays eventually consistent with the Source of Truth (PostgreSQL).

### 4. Pre-computed Analytics
- Instead of the UI aggregating data, the `cacheSyncWorker` will compute key performance indicators (KPIs) and store them in `analytics/summary.json`.
- This includes revenue stats, customer breakdown by tier, and ad spending.

## Consequences

**Positive:**
- **Performance**: Near-zero latency for most UI interactions.
- **Resilience**: The system remains functional (read-only) even if the database or external APIs are temporarily down.
- **Scalability**: Decouples data fetching/processing from UI rendering.

**Negative:**
- **State Complexity**: Introduces a layer of eventual consistency and potential staleness (handled by background refresh).
- **Maintenance**: Requires monitoring of both the database and the JSON cache state.

## Implementation

## Implementation

- Create `src/lib/cacheSync.js` for cache management (Done).
- Implement `src/workers/cacheSyncWorker.js` for event processing (Done).
- Hook API routes to use cache-first logic (Done via `db.js` adaptive connector).
- Implement Facebook Student 360 Synchronization (`sync_leads_to_db.ts`, `sync_conversations_to_db.ts`) (Done).
- Implement Full Database Cloning (`clone_db_to_local.ts`) (Done).
