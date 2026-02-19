# ADR 010: Database-First Product Catalog

## Status
Proposed / Accepted (2026-02-20)

## Context
The system initially relied on a monolithic `catalog.json` file for product and package data. This approach lacked scalability for complex relational data (e.g., packages containing products) and made multi-channel updates difficult. A shift to individual JSON files in `data_hub/products` improved organization, but direct database access was desired for better performance and relational integrity.

## Decision
Transition to a **Database-First** approach for the product catalog.

1.  **Source of Truth**: The PostgreSQL database (Supabase) is now the primary source of truth for the product catalog.
2.  **Seeding/Sync Mechanism**: Individual JSON files in `data_hub/products` (organized into `courses/` and `packages/`) serve as the source for seeding the database via `scripts/sync_products.ts`.
3.  **Prisma Adapter**: Use `@prisma/adapter-pg` to ensure robust database connectivity across different environments (local vs. server).
4.  **Legacy Support**: `catalog.json` is archived (`catalog.json.bak`) and no longer used by the application.

## Consequences
- **Performance**: API routes (`/api/catalog`) now perform direct database queries through Prisma, reducing I/O overhead compared to parsing large JSON files.
- **Maintenance**: Updates to product data should be made in the `products/` JSON files and then synced to the database using `npm run sync-products` (or equivalent).
- **Complexity**: Added dependency on `@prisma/adapter-pg` and `pg`.
- **Integrity**: Enables use of relational features and ACID transactions for orders involving specific products.
