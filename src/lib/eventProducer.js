
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { checkRedisConnection } from './queueCheck';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Singleton Queue Instance to avoid creating multiple connections
let eventQueue;

const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
});

function getQueue() {
    if (!eventQueue) {
        eventQueue = new Queue('fb-events', { connection });
    }
    return eventQueue;
}

/**
 * Adds a Facebook Event to the processing queue.
 * @param {Object} eventData - The raw event payload from Facebook
 */
export async function produceEvent(eventData) {
    try {
        // Simple check to avoid crashing if Redis is down locally
        // In production, we assume Redis is up.
        // const isRedisUp = await checkRedisConnection(); 
        // if (!isRedisUp) {
        //    console.warn('Redis unavailable, skipping queue push (Dev Mode)');
        //    return false;
        // }

        const queue = getQueue();
        await queue.add('process-message', eventData, {
            removeOnComplete: 100, // Keep last 100 completed jobs
            removeOnFail: 500      // Keep last 500 failed jobs for debugging
        });
        console.log(`[Queue] Added job for customer: ${eventData.sender?.id || 'Unknown'}`);
        return true;
    } catch (error) {
        console.error('Failed to add job to queue:', error);
        return false;
    }
}
