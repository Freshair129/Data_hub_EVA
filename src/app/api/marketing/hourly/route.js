import { NextResponse } from 'next/server';

/**
 * API Route to fetch Hourly Facebook Ads insights for a specific date
 * usage: /api/marketing/hourly?date=YYYY-MM-DD
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        if (!date) {
            return NextResponse.json({ error: 'Date is required (YYYY-MM-DD)' }, { status: 400 });
        }

        const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
        const AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;

        if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
            return NextResponse.json({ error: 'Missing Facebook API credentials' }, { status: 500 });
        }

        // Prepare Time Range for single day
        const timeRange = JSON.stringify({
            since: date,
            until: date
        });

        const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?level=account&fields=spend,impressions,clicks,actions,action_values&breakdowns=hourly_stats_aggregated_by_audience_time_zone&time_range=${timeRange}&access_token=${ACCESS_TOKEN}`;

        console.log(`[Hourly API] Fetching for ${date}...`);

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('[Hourly API] FB Error:', data);
            return NextResponse.json({ error: data.error?.message || 'Facebook API Error' }, { status: response.status });
        }

        // Process Data
        // FB returns hourly stats. The breakdown value is in `hourly_stats_aggregated_by_audience_time_zone` field (e.g., "00:00:00 - 00:59:59")

        const hourlyData = data.data.map(item => {
            const timeRange = item.hourly_stats_aggregated_by_audience_time_zone || ''; // "00:00:00 - 00:59:59"
            const hour = parseInt(timeRange.split(':')[0] || '0');

            return {
                hour,
                timeLabel: `${hour.toString().padStart(2, '0')}:00`,
                spend: parseFloat(item.spend || 0),
                impressions: parseInt(item.impressions || 0),
                clicks: parseInt(item.clicks || 0),
                // Parse actions if needed
                actions: item.actions || [],
                action_values: item.action_values || []
            };
        }).sort((a, b) => a.hour - b.hour);

        // Fill missing hours with 0
        const fullDay = [];
        for (let i = 0; i < 24; i++) {
            const existing = hourlyData.find(d => d.hour === i);
            if (existing) {
                fullDay.push(existing);
            } else {
                fullDay.push({
                    hour: i,
                    timeLabel: `${i.toString().padStart(2, '0')}:00`,
                    spend: 0,
                    impressions: 0,
                    clicks: 0,
                    actions: [],
                    action_values: []
                });
            }
        }

        return NextResponse.json({
            success: true,
            date,
            data: fullDay
        });

    } catch (error) {
        console.error('Hourly Insights API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
