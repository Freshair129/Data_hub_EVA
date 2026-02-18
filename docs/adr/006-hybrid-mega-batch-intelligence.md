# ADR 006: Hybrid & Mega-Batch Intelligence Architecture

## Status
Proposed / **Accepted**

## Context
The CRM system processes thousands of chat messages daily. Running deep behavioral AI analysis on every message is prohibitively expensive (Token usage) and results in redundant information. We needed a way to maintain high intelligence while reducing costs and API overhead.

## Decision
We implemented a **Hybrid + Mega-Batch Intelligence** architecture.

### 1. Hybrid Layering
- **Real-time Tier**: An "Intent Guard" in the webhook handler uses fast local heuristics (Regex) to detect immediate sales opportunities (e.g., asking for price, promo, or bank info). Only these trigger immediate AI analysis.
- **Batch Tier**: A background worker (`batch_auditor.py`) runs hourly to process all conversations that were active but didn't trigger a real-time event.

### 2. Mega-Batching (Context Packing)
- Instead of calling the LLM once per customer, we leverage Gemini's 1,000,000+ context window to pack **20-30 conversations into a single prompt**.
- The AI is instructed to return a structured JSON object keyed by `customer_id`.

## Consequences
- **Positive**: 95%+ reduction in API call count.
- **Positive**: 85% reduction in token costs by avoiding redundant analysis of "chatty" low-intent users.
- **Positive**: Near-zero real-time latency for general messages.
- **Neutral**: Customer persona updates may lag up to 1 hour (acceptable for CRM use cases).
- **Negative**: Increased complexity in the background worker and parsing logic.
