/**
 * cacheSyncWorker.js
 * ─────────────────────────────────────────────────────────────
 * BullMQ Worker that consumes 'cache-sync' jobs from Redis.
 * 
 * Jobs are emitted after every DB write via:
 *   emitCacheSyncJob(entity, id, data)
 * 
 * Usage:
 *   node src/workers/cacheSyncWorker.js
 * 
 * Or run alongside eventProcessor.mjs:
 *   node src/workers/cacheSyncWorker.js &
 */

import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { writeCacheEntry, writeCustomerCache, rebuildCustomerIndex, computeAnalyticsSummary, rebuildMarketingMetrics } from '../lib/cacheSync.js';
import { getPrisma } from '../lib/db.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'cache-sync';

const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null
});

// ─── Worker ────────────────────────────────────────────────────

const worker = new Worker(QUEUE_NAME, async (job) => {
    const { type = 'sync', entity, id, data } = job.data;

    // ── Job: rebuild-index ──────────────────────────────────
    if (type === 'rebuild-index') {
        console.log('[CacheSyncWorker] 📋 Rebuilding customer index...');
        const customers = job.data.customers || [];
        rebuildCustomerIndex(customers.length > 0 ? customers : undefined);
        return { type, rebuilt: true };
    }

    // ── Job: rebuild-marketing ─────────────────────────────
    if (type === 'rebuild-marketing') {
        console.log('[CacheSyncWorker] 📈 Rebuilding marketing metrics...');
        const prisma = await getPrisma();
        if (prisma) {
            const dailyMetrics = await prisma.adDailyMetric.findMany({
                where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } // last 30 days
            });
            rebuildMarketingMetrics(dailyMetrics);
        }
        return { type, rebuilt: true };
    }

    // ── Job: rebuild-summary ────────────────────────────────
    if (type === 'rebuild-summary') {
        console.log('[CacheSyncWorker] 📊 Rebuilding analytics summary...');
        const { customers = [], orders = [] } = job.data;
        computeAnalyticsSummary(customers, orders);
        return { type, rebuilt: true };
    }

    // ── Job: sync (default) — write individual record ─────── 
    if (!id || !data) {
        throw new Error(`[CacheSyncWorker] Invalid job data: ${JSON.stringify(job.data)}`);
    }

    if (entity === 'customer') {
        console.log(`[CacheSyncWorker] Splitting customer cache for ${id} ...`);
        writeCustomerCache(id, data);
    } else {
        console.log(`[CacheSyncWorker] Syncing cache/${entity}/${id}.json ...`);
        const success = writeCacheEntry(entity, id, data);
        if (!success) {
            throw new Error(`[CacheSyncWorker] Failed to write cache for ${entity}/${id}`);
        }
    }

    return { entity, id, synced: true };

}, { connection, concurrency: 5 });

worker.on('completed', (job) => {
    console.log(`[CacheSyncWorker] ✅ Job ${job.id} done → cache/${job.data.entity}/${job.data.id}.json`);
});

worker.on('failed', (job, err) => {
    console.error(`[CacheSyncWorker] ❌ Job ${job?.id} failed: ${err.message}`);
});

console.log(`[CacheSyncWorker] 🚀 Listening on queue: "${QUEUE_NAME}"`);

// ─── Emitter (also exported for use in API/DB layer) ───────────

export const cacheSyncQueue = new Queue(QUEUE_NAME, { connection });

const JOB_DEFAULTS = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50
};

/**
 * Emit a cache sync job after a DB write.
 */
export async function emitCacheSyncJob(entity, id, data) {
    try {
        await cacheSyncQueue.add('sync', { type: 'sync', entity, id, data }, JOB_DEFAULTS);
        console.log(`[CacheSyncWorker] 📤 Emitted sync job for ${entity}/${id}`);
    } catch (err) {
        console.error('[CacheSyncWorker] ❌ Failed to emit sync job:', err.message);
        writeCacheEntry(entity, id, data); // fallback: write directly
    }
}

/**
 * Emit a rebuild-index job after the customer list changes.
 * @param {object[]} customers - Optional fresh list to avoid re-reading files
 */
export async function emitRebuildIndex(customers = []) {
    try {
        await cacheSyncQueue.add('rebuild-index', { type: 'rebuild-index', customers }, JOB_DEFAULTS);
        console.log('[CacheSyncWorker] 📤 Emitted rebuild-index job');
    } catch (err) {
        console.error('[CacheSyncWorker] ❌ Failed to emit rebuild-index:', err.message);
        rebuildCustomerIndex(customers.length > 0 ? customers : undefined); // fallback
    }
}

/**
 * Emit a rebuild-summary job for analytics KPIs.
 * @param {object[]} customers
 * @param {object[]} orders
 */
export async function emitRebuildSummary(customers = [], orders = []) {
    try {
        await cacheSyncQueue.add('rebuild-summary', { type: 'rebuild-summary', customers, orders }, JOB_DEFAULTS);
        console.log('[CacheSyncWorker] 📤 Emitted rebuild-summary job');
    } catch (err) {
        console.error('[CacheSyncWorker] ❌ Failed to emit rebuild-summary:', err.message);
        computeAnalyticsSummary(customers, orders); // fallback
    }
}

/**
 * Emit a rebuild-marketing job to refresh daily ad insights.
 */
export async function emitRebuildMarketing() {
    try {
        await cacheSyncQueue.add('rebuild-marketing', { type: 'rebuild-marketing' }, JOB_DEFAULTS);
        console.log('[CacheSyncWorker] 📤 Emitted rebuild-marketing job');
    } catch (err) {
        console.error('[CacheSyncWorker] ❌ Failed to emit rebuild-marketing:', err.message);
    }
}
