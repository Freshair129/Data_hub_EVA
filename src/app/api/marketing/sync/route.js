import { NextResponse } from 'next/server';
import { runPython } from '@/lib/pythonBridge';
import { emitRebuildMarketing, emitRebuildSummary } from '@/workers/cacheSyncWorker';
import { getAllCustomers } from '@/lib/db';

/**
 * POST /api/marketing/sync
 * Triggers the Python bulk sync script and then regenerates local cache.
 */
export async function POST(request) {
    try {
        console.log('[MarketingSync] 🚀 Triggering manual hybrid sync...');

        // 1. Run Python Bulk Sync (Marketing API -> DB)
        const pythonResult = await runPython('marketing_sync.py', {});

        if (!pythonResult.success) {
            console.error('[MarketingSync] ❌ Python sync failed:', pythonResult.error);
            return NextResponse.json({
                success: false,
                error: 'Python marketing sync failed',
                details: pythonResult.error
            }, { status: 500 });
        }

        console.log('[MarketingSync] ✅ Python sync complete. Triggering cache rebuild...');

        // 2. Trigger cache rebuilds in background
        // rebuild-marketing: reads from ad_daily_metrics and writes to cache
        await emitRebuildMarketing();

        // rebuild-summary: refreshes dashboard KPIs
        const customers = await getAllCustomers();
        await emitRebuildSummary(customers);

        return NextResponse.json({
            success: true,
            message: 'Hybrid marketing sync triggered successfully',
            python: pythonResult
        });

    } catch (error) {
        console.error('[MarketingSync] ❌ API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
