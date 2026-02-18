# Changelog

All notable changes to the CRM project will be documented in this file.

## [0.2.0] - 2026-02-18

### Added
- **Hybrid Architecture (Python Worker):**
    - `src/workers/python/event_processor.py`: Python-based event consumer handling chat sync and AI tasks.
    - `src/workers/python/requirements.txt`: Python dependencies (redis, requests, facebook-business).
    - `src/lib/pythonBridge.js`: Execution bridge between Node.js and Python.
    - `src/workers/python/integrity_check.py`: Proactive anomaly detector for business logic errors.
- **Workflow Automation:**
    - `.agent/workflows/checkpoint.md`: Professional-grade maintenance workflow with QA and Git automation.
- **Error Resolution & Persistent Memory:**
    - `src/lib/errorLogger.js`: Universal logging with unique Error IDs and tags.
    - `docs/adr/004-error-resolution-persistence.md`: Standardizing how errors and fixes are tracked.
    - `incident_log.md`: Persistent record of logic errors and their resolution quality.

### Changed
- **Logic Delegation:** Migrated `syncChat` and `verifySlip` core logic from Node.js to the Python Worker.
- **Full Delegation:** `src/lib/eventHandler.js` now acts as a dispatcher to the Python Bridge.

### Fixed
- **Redis Dependency:** Implemented "Direct Bridge Mode" to allow Python logic execution without a running Redis server.

## [0.1.1] - 2026-02-18
### Added
- **Event-Driven Architecture:**


## [0.1.0] - 2026-02-12
### Added
- Initial project setup with Next.js.
- Basic CRM functionalities: Customer Profile, Chat UI, Dashboard.
- Facebook Graph API integration.
