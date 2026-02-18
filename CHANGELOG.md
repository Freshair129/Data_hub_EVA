# Changelog

All notable changes to the CRM project will be documented in this file.

## [Unreleased]
### Added
- **Phase 20: Customer ID Standardization (Stable V7)**: Refactored existing customer IDs to alphabetical-sequential format `TVS-CUS-[CHANNEL]-[YEAR]-[SERIAL]`.
- **Phase 19: Mega-Batch Intelligence**: Implemented Context Packing, reducing API overhead by 95% by analyzing 20+ chats per call.
- **Phase 18: Hybrid Intelligence**: Implemented Token Guard (Real-time intent detection) and Batch Auditor (Hourly sweep) to optimize costs.
- **ADR 007**: Documented the immutable Customer ID standard.

### Fixed
- **Profile Fragmentation**: Resolved tag visibility issues caused by consolidated profile folders.
- **Data Persistence**: Fixed `DATA_DIR` pathing errors in Python workers.
- **Discovery Resolution**: Fixed path resolution in AI product discovery when IDs are fragmented.

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
