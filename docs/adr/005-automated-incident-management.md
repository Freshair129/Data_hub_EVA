# ADR 005: Automated Incident Recording & Internal Post-Mortems

## Context
Previously, incidents (logic errors, system failures) were recorded manually in an external `incident_log.md` and through manual artifacts. This process was error-prone, lacked consistent context (like chat history), and resided outside the primary project workspace.

## Decision
We will implement an **Automated Incident Management** system within the project core (`crm-app`):
1.  **Internal Registry**: `crm-app/docs/incident_log.md` will serve as the master index.
2.  **Automated Reporting**: A dedicated utility `incidentManager.js` will generate detailed post-mortem reports in `crm-app/docs/incidents/`.
3.  **Context Automation**: Reports will automatically include relevant chat/audit logs if a `contextId` (e.g., `conversation_id`) is provided.
4.  **Standardization**: Every critical anomaly detected by the Watchdog (`integrity_check.py`) must trigger an automated incident report.

## Consequences
- **Pros**: Ensures 100% traceability; lowers the barrier to documenting errors; centralizes knowledge within the repo.
- **Cons**: Adds a small amount of file overhead in `docs/incidents/`.
- **Note**: This standard aligns with the "Observability" pillar of the system architecture.
