import { NextResponse } from 'next/server';

/**
 * Facebook Webhook Handler
 * This route listens for events from the Facebook Graph API (Messages, Comments, etc.)
 */
export async function GET(req) {
    // 1. Webhook Verification (Required by Facebook)
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'your_secret_token';

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            return new Response(challenge, { status: 200 });
        } else {
            return new Response('Forbidden', { status: 403 });
        }
    }
}

export async function POST(req) {
    try {
        const body = await req.json();

        // 2. Security Check (Validate X-Hub-Signature if needed)

        // 3. Process Webhook Payload
        if (body.object === 'page') {
            body.entry.forEach(async (entry) => {
                if (!entry.messaging) return;

                const webhook_event = entry.messaging[0];
                const sender_id = webhook_event.sender.id;
                const recipient_id = webhook_event.recipient.id;
                const message = webhook_event.message;

                // LOGGING: Save raw event for Boss to inspect metadata
                try {
                    const logDir = path.join(process.cwd(), '..', 'marketing', 'logs', 'webhook');
                    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
                    const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.json`);
                    fs.appendFileSync(logFile, JSON.stringify(body, null, 2) + '\n---\n');
                } catch (e) { console.error('Webhook log error:', e); }

                // DETECT ADMIN REPLY: If sender is NOT the customer (recipient is customer or sender matches Page ID)
                // In Messenger Webhooks, the customer is usually the one with the long PSID.
                // If the message contains metadata like 'tags' or 'app_id', it might be from a specific admin tool.

                console.log(`[Webhook] Event from ${sender_id} to ${recipient_id}: "${message?.text}"`);

                // If we detect an admin reply, we could trigger a profile update here.

                // LOGIC: Map PSID to CRM Customer
                // In a real system, you would query your DB to find which customer 
                // has this Facebook PSID and then add to their Timeline.
            });

            return NextResponse.json({ status: 'EVENT_RECEIVED' });
        } else {
            return NextResponse.json({ error: 'Not a page event' }, { status: 404 });
        }
    } catch (error) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
