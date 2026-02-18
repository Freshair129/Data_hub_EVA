import { logAudit } from './auditLogger';
import { runPython } from './pythonBridge';

/**
 * Unified Event Logic (Node.js -> Python Delegation)
 * Standardizes processing through the AI Engine in Python.
 */
export async function handleEvent(event, jobId = 'DIRECT') {
    const senderId = event.sender?.id;
    const traceId = `TRACE-${jobId}-${Date.now()}`;

    logAudit({
        action: 'PROCESS_STARTED',
        actor: jobId === 'DIRECT' ? 'WebhookAPI' : 'EventWorker',
        target: senderId || 'Unknown',
        status: 'PENDING',
        traceId,
        details: { jobId, eventType: 'message' }
    });

    if (!senderId) {
        throw new Error('Invalid Event: Missing Sender ID');
    }

    try {
        console.log(`[EventHandler] Delegating event ${traceId} to Python AI Engine...`);

        // Execute the entire event logic in Python (Sync + Analysis + Profile Update)
        const result = await runPython('event_processor.py', event);

        if (result.success) {
            logAudit({
                action: 'PROCESS_COMPLETED',
                actor: 'PythonAI',
                target: senderId,
                status: 'SUCCESS',
                traceId,
                details: result.intelligence
            });
            console.log(`[EventHandler] Python processing successful for ${senderId}`);
            return true;
        } else {
            throw new Error(result.error || 'Python Processing Failed');
        }

    } catch (error) {
        logAudit({
            action: 'PROCESS_FAILED',
            actor: 'PythonAI',
            target: senderId,
            status: 'FAILED',
            traceId,
            details: { error: error.message }
        });
        console.error('[EventHandler] Delegation Failed:', error);
        return false;
    }
}
