import { NextResponse } from 'next/server';

/**
 * API Route to fetch real Facebook Ads Insights (Spend, Reach, etc.)
 */
export async function GET() {
    try {
        const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
        const AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;

        if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
            return NextResponse.json({ error: 'Facebook credentials not configured' }, { status: 400 });
        }

        // Fetch Insights for last 30 days
        const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,reach,actions,action_values&date_preset=last_30d&access_token=${ACCESS_TOKEN}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('Facebook Marketing API Error:', data);

            // Handle Token Expiration (Error Code 190)
            if (data.error?.code === 190 || data.error?.type === 'OAuthException') {
                return NextResponse.json({
                    success: false,
                    errorType: 'TOKEN_EXPIRED',
                    error: 'Facebook access token has expired or is invalid.'
                }, { status: 401 });
            }

            return NextResponse.json({ error: data.error?.message || 'Failed to fetch insights' }, { status: 500 });
        }

        // Return the first set of insights (summary for last 30d)
        return NextResponse.json({
            success: true,
            insights: data.data?.[0] || { spend: "0", reach: "0", impressions: "0", clicks: "0" }
        });

    } catch (error) {
        console.error('Marketing Insights API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
