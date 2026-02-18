import { NextResponse } from 'next/server';

/**
 * API Route to handle Slip Verification
 * This route acts as a proxy to keep the SLIPOK_API_KEY secure on the server.
 */
export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // 1. Get API Credentials from Environment Variables
        const API_KEY = process.env.SLIPOK_API_KEY || 'YOUR_API_KEY_HERE';
        const BRANCH_ID = process.env.SLIPOK_BRANCH_ID || 'YOUR_BRANCH_ID';

        // 2. Prepare for Real API Call (Example: SlipOK)
        // Note: In a real scenario, you would uncomment this part
        /*
        const externalFormData = new FormData();
        externalFormData.append('files', file);
        externalFormData.append('log', 'true'); // optional: log the transactions

        const response = await fetch('https://api.slipok.com/api/line/apikey/' + BRANCH_ID, {
            method: 'POST',
            headers: {
                'x-lib-apikey': API_KEY
            },
            body: externalFormData
        });

        const result = await response.json();
        
        if (!response.ok || !result.success) {
            return NextResponse.json({ 
                error: result.message || 'Verification failed',
                details: result 
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: {
                amount: result.data.amount,
                date: result.data.date,
                transaction_id: result.data.transRef,
                bank: result.data.sender.bank,
                receiver: result.data.receiver.name
            }
        });
        */

        // --- MOCK RESPONSE FOR INFRASTRUCTURE TESTING ---
        // This ensures the logic works while waiting for a real API Key
        console.log('Backend received file:', file.name, 'size:', file.size);

        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network latency

        return NextResponse.json({
            success: true,
            data: {
                amount: 500.00,
                date: new Date().toLocaleDateString('th-TH'),
                time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                bank: 'KASIKORNBANK (PROXIED)',
                transaction_id: 'REAL-INFRA-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
                receiver: 'DATA HUB CO., LTD.'
            }
        });

    } catch (error) {
        console.error('Slip Verification Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
