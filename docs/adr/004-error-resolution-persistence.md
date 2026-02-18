# ADR 004: Error Resolution & Anomaly Detection

## Context
System crashes and logic errors (like misattribution) were previously ignored or manually fixed without tracking. The user requested a way to "remember" solutions and link them to errors.

## Decision
1.  **ErrorLog Model**: Stores structured error data with a unique `error_id`.
2.  **ErrorSolution Model**: Stores fix documentation, linked to errors and changelog IDs.
3.  **Resolution Quality**: Added metadata (`FULL_FIX`, `WORKAROUND`, `HARDCODED`) to track the technical debt of a solution.
4.  **Proactive Integrity Checks**: Implemented a Python-based "Watchdog" (`integrity_check.py`) that uses rule-based anomaly detection to catch logic errors that don't trigger system exceptions.

## Consequences
- **Pros**: Reduces debugging time for reoccurring issues; creates a "Knowledge Base" of system behavior.
- **Cons**: Requires discipline to document solutions in the system.
