# 8. Ad Data Architecture (A/B Testing)

Date: 2026-02-19

## Status

Accepted

## Context

The project needs to track "Active Ads" and "A/B Testing State" to optimize marketing ROI. Currently, ad data exists only as JSON logs (`marketing/logs`), which makes it difficult to:
1.  Query which ads are currently running.
2.  Compare performance between specific variants (e.g., Red Image vs. Blue Image).
3.  Maintain state for long-running experiments.

## Decision

We will implement a relational database schema using Prisma to store Ad Data.

The schema will include:
1.  **AdAccount**: To support multi-account scalability.
2.  **Campaign**: Enhanced to link to AdSets.
3.  **AdSet**: To track targeting and budget.
4.  **Ad**: The core unit, linking to Creative and Experiment.
5.  **AdCreative**: Decoupling content (Image/Copy) from delivery.
6.  **Experiment**: To group Ads into logical test units.

## Consequences

**Positive:**
*   **Queryability**: Can instantly answer "Which ads are active?" via SQL/Prisma.
*   **Granularity**: Can analyze performance by Creative, not just by Ad ID.
*   **State Management**: Experiments have a clear lifecycle (PLANNED -> RUNNING -> CONCLUDED).

**Negative:**
*   **Complexity**: Requires a synchronization script to fetch data from Facebook API and update the DB.
*   **Storage**: Database size will grow with daily metrics snapshots.

## Implementation

*   Update `prisma/schema.prisma` (Done).
*   Create synchronization worker in Python (`data_service.py` update required).
