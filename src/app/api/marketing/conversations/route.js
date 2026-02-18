import { NextResponse } from 'next/server';

/**
 * API Route to fetch recent conversations and identify staff responders
 */
export async function GET() {
    try {
        const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
        const PAGE_ID = process.env.FB_PAGE_ID;

        if (!PAGE_ACCESS_TOKEN || !PAGE_ID) {
            return NextResponse.json({ error: 'Facebook Page credentials not configured' }, { status: 400 });
        }

        // Fetch conversations with recent messages and participants
        // fields: participants, messages{from, message, created_time}
        const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=participants,messages.limit(5){from,message,created_time}&access_token=${PAGE_ACCESS_TOKEN}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('Facebook Conversations API Error:', data);
            return NextResponse.json({ error: data.error?.message || 'Failed to fetch conversations' }, { status: 500 });
        }

        // Process conversations to identify the likely agent
        const mappedConversations = (data.data || []).map(conv => {
            // Find the customer (usually the one who isn't the Page)
            const customer = conv.participants?.data?.find(p => p.id !== PAGE_ID);

            // Find the most recent staff reply
            const messages = conv.messages?.data || [];
            const staffReply = messages.find(m => m.from.id === PAGE_ID);

            return {
                conversation_id: conv.id,
                customer_name: customer?.name || 'Unknown Customer',
                customer_id: customer?.id,
                last_staff_reply: staffReply?.from?.name || null, // Note: This might just be the Page Name
                staff_name: staffReply ? 'Staff' : 'Unassigned', // If we can't get exact personal name
                messages: messages.slice(0, 3)
            };
        });

        return NextResponse.json({
            success: true,
            data: mappedConversations
        });

    } catch (error) {
        console.error('Conversations API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
