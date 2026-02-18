import { writeAuditLog } from './db';

/**
 * Audit Logger
 * Records events via the DB Adapter (JSONL or PostgreSQL).
 * 
 * @param {Object} entry - The log entry object
 * @param {string} entry.action - Action name (e.g., 'SYNC_CHAT', 'VERIFY_SLIP')
 * @param {string} entry.actor - Actor performing the action (e.g., 'Worker', 'System')
 * @param {string} entry.target - Target entity (e.g., Customer ID)
 * @param {string} entry.status - Status (SUCCESS, FAILED, PENDING)
 * @param {Object} [entry.details] - Additional context
 * @param {string} [entry.traceId] - Unique ID to trace the event flow
 */
export async function logAudit({ action, actor, target, status, details, traceId }) {
    const logEntry = {
        traceId: traceId || `TRACE-${Date.now()}`,
        action,
        actor,
        target,
        status,
        details: details || {}
    };

    try {
        await writeAuditLog(logEntry);
    } catch (error) {
        console.error('[Audit] Logging Failed:', error);
    }
}
