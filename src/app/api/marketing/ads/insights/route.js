import { NextResponse } from 'next/server';

/**
 * API Route to fetch historical insights for a specific AD_ID
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const ad_id = searchParams.get('ad_id');
        const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

        if (!ad_id) {
            return NextResponse.json({ error: 'AD_ID is required' }, { status: 400 });
        }

        if (!ACCESS_TOKEN) {
            return NextResponse.json({ error: 'Facebook credentials not configured' }, { status: 400 });
        }

        // Fetch daily insights for the specific ad for the last 30 days
        const url = `https://graph.facebook.com/v19.0/${ad_id}/insights?fields=spend,impressions,clicks,reach,ctr,actions,action_values&date_preset=last_30d&time_increment=1&access_token=${ACCESS_TOKEN}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error(`Facebook Ad Insights API Error for ${ad_id}:`, data);
            return NextResponse.json({ error: data.error?.message || 'Failed to fetch ad insights' }, { status: 500 });
        }

        const daily = (data.data || []).map(day => ({
            date: day.date_start,
            spend: parseFloat(day.spend || 0),
            impressions: parseInt(day.impressions || 0),
            clicks: parseInt(day.clicks || 0),
            reach: parseInt(day.reach || 0),
            ctr: parseFloat(day.ctr || 0),
            actions: day.actions || [],
            action_values: day.action_values || []
        }));

        return NextResponse.json({
            success: true,
            data: daily
        });

    } catch (error) {
        console.error('Ad Insights API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
