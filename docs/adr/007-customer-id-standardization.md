# ADR 007: Standardized Customer ID System (TVS-CUS)

## Status
Proposed / **Accepted**

## Context
The current Customer ID system is fragmented, using temporary IDs (`c001`), Facebook IDs (`MSG-...`), and inconsistent prefixes (`FB-KUK-...`). To align with the **Stable V7 (Immutable System)** used for courses, we need a permanent, structured, and predictable Customer ID system.

## Decision
We will adopt the **TVS-CUS** standard for all customers.

### ID Format: `TVS-CUS-[CHANNEL]-[YEAR]-[SERIAL]`
- **`TVS`**: The V School (Prefix)
- **`CUS`**: Segment (Customer)
- **`CHANNEL`**: Source channel (2 digits):
    - `FB`: Facebook
    - `LN`: LINE
    - `WB`: Web/Direct
    - `WL`: Walk-in
- **`YEAR`**: Year of registration (2 digits, e.g., `26` for 2026)
- **`SERIAL`**: 4-digit sequential number (e.g., `0001` to `9999`)

**Example**: `TVS-CUS-FB-26-0123`

## Implementation Strategy
1.  **Immutability**: Once assigned, this ID is permanent.
2.  **Migration**: Existing folders and JSON `customer_id` fields will be refactored.
3.  **Discovery**: APIs will continue to support searching by Facebook ID, but the primary key will be this new standard.
4.  **Folder Structure**: Customer folders will be named exactly as their standardized ID.

## Consequences
- **Positive**: Consistent, professional, and professional-grade data structure.
- **Positive**: Eliminates folder fragmentation.
- **Positive**: Easier to track growth and channel distribution via ID alone.
- **Negative**: Requires a one-time migration of all existing customer folders.
