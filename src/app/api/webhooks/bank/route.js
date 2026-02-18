import { NextResponse } from 'next/server';

/**
 * POST: Simulate Bank Transfer Event (SCB/KBank)
 * API for testing the "Slip Simulcast" scenario.
 */
export async function POST(req) {
    try {
        const body = await req.json();

        // Basic Validation
        if (!body.amount || !body.transRef) {
            return NextResponse.json({ error: 'Invalid Payload' }, { status: 400 });
        }

        console.log(`[BankWebhook] Received Transfer: ${body.transRef} | Amount: ${body.amount}`);

        // TODO: Push to Redis Queue (Phase 3.2)
        // queue.add('bank-events', body);

        return NextResponse.json({
            success: true,
            message: 'Transfer queued for processing',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Bank Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
