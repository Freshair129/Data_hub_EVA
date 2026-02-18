
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { logAudit } from '../lib/auditLogger.js';
import { syncChat } from '../lib/chatService.js';
import { verifySlip } from '../lib/slipService.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
});

/**
 * Event Processor Worker
 * Consumes jobs from 'fb-events' queue.
 */
const worker = new Worker('fb-events', async (job) => {
    const event = job.data;
    const senderId = event.sender?.id;
    // Map PSID to Conversation ID (Simple assumption for demo)
    const conversationId = `t_${senderId}`;

    const traceId = `TRACE-${job.id}`;

    logAudit({
        action: 'JOB_STARTED',
        actor: 'EventWorker',
        target: senderId || 'Unknown',
        status: 'PENDING',
        traceId,
        details: { jobId: job.id, eventType: 'message' }
    });

    if (!senderId) {
        throw new Error('Invalid Event: Missing Sender ID');
    }

    try {
        // 1. Reactive Sync: Pull latest chat history
        console.log(`[Worker] Syncing chat for ${conversationId}...`);
        const chatResult = await syncChat(conversationId);

        if (chatResult.success) {
            console.log(`[Worker] Chat synced. Source: ${chatResult.source}`);
        } else {
            console.warn(`[Worker] Chat sync warning: ${chatResult.error}`);
        }

        // 2. Slip Detection
        if (event.attachments && event.attachments[0]?.type === 'image') {
            const imageUrl = event.attachments[0].payload.url;

            logAudit({
                action: 'SLIP_DETECTED',
                actor: 'EventWorker',
                target: senderId,
                status: 'PROCESSING',
                traceId,
                details: { imageUrl }
            });

            const verificationResult = await verifySlip(imageUrl);

            if (verificationResult.verified) {
                logAudit({
                    action: 'SLIP_VERIFIED',
                    actor: 'EventWorker',
                    target: senderId,
                    status: 'SUCCESS',
                    traceId,
                    details: verificationResult.data
                });
                console.log('[Worker] Slip Verified! (Simulated Database Update)');
            } else {
                logAudit({
                    action: 'SLIP_REJECTED',
                    actor: 'EventWorker',
                    target: senderId,
                    status: 'FAILED',
                    traceId,
                    details: { error: verificationResult.error }
                });
            }
        }

        logAudit({
            action: 'JOB_COMPLETED',
            actor: 'EventWorker',
            target: senderId,
            status: 'SUCCESS',
            traceId
        });

        return { status: 'processed', sender: senderId };

    } catch (error) {
        logAudit({
            action: 'JOB_FAILED',
            actor: 'EventWorker',
            target: senderId,
            status: 'FAILED',
            traceId,
            details: { error: error.message }
        });
        throw error;
    }

}, { connection });

worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} finished!`);
});

worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} failed with ${err.message}`);
});

console.log('[Worker] Event Processor started. Listening for jobs...');
