
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { produceEvent } from '@/lib/eventProducer';
import { logError } from '@/lib/errorLogger';
import { handleEvent } from '@/lib/eventHandler';

// Constants
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'my_secure_verify_token';
const FB_APP_SECRET = process.env.FB_APP_SECRET;

/**
 * GET: Facebook Webhook Verification
 * Facebook sends a challenge to verify ownership of the endpoint.
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode && token) {
        if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            return new NextResponse(challenge, { status: 200 });
        } else {
            return new NextResponse('Forbidden', { status: 403 });
        }
    }

    return new NextResponse('Bad Request', { status: 400 });
}

/**
 * POST: Receive Event Updates
 */
export async function POST(req) {
    try {
        // 1. Signature Verification (Security)
        const signature = req.headers.get('x-hub-signature-256');
        const bodyText = await req.text(); // Need raw body for HMAC

        if (FB_APP_SECRET) {
            const expectedSignature = 'sha256=' + crypto
                .createHmac('sha256', FB_APP_SECRET)
                .update(bodyText)
                .digest('hex');

            if (signature !== expectedSignature) {
                console.error('Invalid X-Hub-Signature');
                return new NextResponse('Unauthorized', { status: 401 });
            }
        } else {
            console.warn('FB_APP_SECRET not set, skipping signature validation (Dev Mode)');
        }

        const body = JSON.parse(bodyText);

        // 2. Event Handling
        if (body.object === 'page') {

            console.log(`[Webhook] Received ${body.entry.length} entries`);

            // Use Promise.all to handle multiple entries concurrently
            await Promise.all(body.entry.map(async (entry) => {
                const webhookEvent = entry.messaging ? entry.messaging[0] : null;

                if (webhookEvent) {
                    // Try Redis Queue first
                    const queued = await produceEvent(webhookEvent);

                    if (queued) {
                        console.log('[Webhook] Event queued for processing:', webhookEvent.sender?.id);
                    } else {
                        // FALLBACK: Redis down? Run directly (Direct Mode)
                        console.warn('[Webhook] Queue unavailable. Running in Direct Mode...');
                        await handleEvent(webhookEvent, 'DIRECT_FALLBACK');
                    }
                }
            }));

            return new NextResponse('EVENT_RECEIVED', { status: 200 });
        } else {
            return new NextResponse('Not Found', { status: 404 });
        }

    } catch (error) {
        console.error('Webhook Error:', error);
        await logError(error, 'webhook_facebook', {
            method: 'POST',
            url: req.url
        }, ['#critical', '#webhook']);

        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
