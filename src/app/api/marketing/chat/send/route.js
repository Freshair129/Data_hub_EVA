import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { recipientId, message } = await request.json();
        const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

        if (!recipientId || !message) {
            return NextResponse.json({ error: 'Missing recipientId or message' }, { status: 400 });
        }

        if (!PAGE_ACCESS_TOKEN) {
            return NextResponse.json({ error: 'Facebook Page credentials not configured' }, { status: 400 });
        }

        // Send message using the Send API
        const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text: message }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Facebook Send API Error:', data);
            return NextResponse.json({ error: data.error?.message || 'Failed to send message' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Chat Send API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
