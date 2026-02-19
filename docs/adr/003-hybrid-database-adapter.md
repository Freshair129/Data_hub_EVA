# ADR 003: Hybrid Database Adapter (JSON & Prisma)

## Context
The project started with a strict "Zero Config" requirement using JSON flat files for customer data and chat logs. As we moved into Phase 6 (Sales Automation) and Phase 11 (Error Logging), we required more complex queries, relations, and transactional integrity which JSON files cannot efficiently provide.

## Decision
We implemented a **Strategy Pattern** in `src/lib/db.js` that supports two adapters:
1.  **JSON Adapter**: The default, using the file system as the primary store.
2.  **Prisma Adapter**: Used for PostgreSQL (Local/Prod) or Supabase.

The system determines which adapter to use based on the `DB_ADAPTER` environment variable. To resolve environment-specific initialization issues, the Prisma adapter has been enhanced to use `@prisma/adapter-pg` (PostgreSQL Driver Adapter).

## Consequences
- **Pros**: Maintains "instant start" capability for new developers while providing a path to "Production Grade" reliability.
- **Cons**: Increased complexity in the data layer (need to maintain mappers between JSON shapes and Prisma models).
- **Risk**: Potential for data drift if one adapter is used more than the other during development.
