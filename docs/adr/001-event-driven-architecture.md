# ADR 001: Adoption of Event-Driven Architecture & Reactive Sync

**Date:** 2026-02-18
**Status:** Accepted

## Context
The previous CRM system relied on a **Polling Architecture** to fetch customer interactions from Facebook.
- **Mechanism:** The frontend (`FacebookChat.js`) polled the API every 15 seconds for conversations and every 5 seconds for messages. A separate interval (5 minutes) triggered a full customer sync.
- **Problems:**
    1.  **High Latency:** Messages could be delayed by up to 15 seconds.
    2.  **Resource Waste:** Continuous API calls were made even when no activity occurred.
    3.  **API Rate Limits:** Frequent polling risked hitting Facebook Graph API limits.
    4.  **Tightly Coupled:** Fetch logic was embedded in UI components, making it hard to decouple or run in the background.

## Decision
We have decided to migrate to an **Event-Driven Architecture** using a **"Reactive Sync"** model.

### Key Components
1.  **Ingestion:** Facebook Webhooks (`/api/webhooks/facebook`) receive real-time notifications.
2.  **Buffering:** Redis Message Queue via `bullmq` (optional/fallback supported).
3.  **Processing:** A dedicated background Worker (`eventProcessor.mjs`) handles the business logic.
4.  **Shared Logic:** Chat synchronization and Slip Verification logic are extracted into shared libraries (`src/lib/chatService.js`, `src/lib/slipService.js`) and `src/lib/eventHandler.js`.
5.  **Audit Logging:** Structured JSONL logging (`src/lib/auditLogger.js`) tracks every step.

### Modes of Operation
- **Queue Mode (Preferred):** Webhook -> Redis -> Worker. Ensures high scalability and fault tolerance.
- **Direct Mode (Fallback):** Webhook -> Direct Handler. Used when Redis is unavailable (e.g., local dev without Docker), ensuring functionality is never blocked.

## Consequences
### Positive
- **Real-time:** Updates are pushed instantly.
- **Efficiency:** Resources are used only when events occur.
- **Scalability:** The separation of ingestion and processing allows independent scaling.
- **Traceability:** Structured logs provide a clear forensic trail.

### Negative
- **Complexity:** Requires additional infrastructure (Redis) and management (Worker process).
- **Environment Dependency:** Developers need to set up Redis or rely on the fallback mode.

## Compliance
- **PDPA:** Chat logs are stored securely locally.
- **Forensic:** All automated actions are logged with `TRACE-ID`.
