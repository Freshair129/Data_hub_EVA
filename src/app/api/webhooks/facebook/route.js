import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
const eventQueue = new Queue('fb-events', { connection });

/**
 * Facebook Webhook - Verification & Event Handling
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'vschool_secret_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[Webhook] Verification Successful');
        return new Response(challenge, { status: 200 });
    } else {
        console.warn('[Webhook] Verification Failed');
        return new Response('Forbidden', { status: 403 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        console.log('[Webhook] Received event:', JSON.stringify(body, null, 2));

        // 1. Audit Log incoming payload
        // (In a real system, you'd save this to a 'webhooks' log file or DB)

        // 2. Dispatch to Background Queue (eventProcessor)
        // This ensures the webhook returns 200 OK immediately as per FB requirements
        await eventQueue.add('process-event', body, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Webhook] POST Error:', error.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
