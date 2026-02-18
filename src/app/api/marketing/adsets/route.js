import { NextResponse } from 'next/server';

/**
 * API Route to fetch Facebook Ad Sets with per-adset insights
 */
export async function GET(request) {
    try {
        const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
        const AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;

        if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
            return NextResponse.json({ error: 'Facebook credentials not configured' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || 'maximum';
        const preset = range === 'last_30d' ? 'last_30d' : 'maximum';

        const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/adsets?fields=name,status,campaign_id,targeting,daily_budget,lifetime_budget,optimization_goal,insights.date_preset(${preset}){spend,impressions,clicks,reach,cpc,cpm,ctr,actions,action_values,cost_per_action_type}&limit=100&access_token=${ACCESS_TOKEN}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('Facebook Adsets API Error:', data);

            // Handle Token Expiration (Error Code 190)
            if (data.error?.code === 190) {
                return NextResponse.json({
                    success: false,
                    errorType: 'TOKEN_EXPIRED',
                    error: 'Facebook access token has expired or is invalid.'
                }, { status: 401 });
            }

            return NextResponse.json({ error: data.error?.message || 'Failed to fetch adsets' }, { status: 500 });
        }

        const adsets = (data.data || []).map(adset => {
            const ins = adset.insights?.data?.[0] || {};
            return {
                id: adset.id,
                name: adset.name,
                status: adset.status,
                campaign_id: adset.campaign_id,
                optimization_goal: adset.optimization_goal,
                daily_budget: adset.daily_budget ? Number(adset.daily_budget) / 100 : null,
                lifetime_budget: adset.lifetime_budget ? Number(adset.lifetime_budget) / 100 : null,
                spend: parseFloat(ins.spend || 0),
                impressions: parseInt(ins.impressions || 0),
                clicks: parseInt(ins.clicks || 0),
                reach: parseInt(ins.reach || 0),
                cpc: parseFloat(ins.cpc || 0),
                cpm: parseFloat(ins.cpm || 0),
                ctr: parseFloat(ins.ctr || 0),
                actions: ins.actions || [],
                action_values: ins.action_values || [],
                cost_per_action_type: ins.cost_per_action_type || [],
            };
        });

        return NextResponse.json({
            success: true,
            data: adsets
        });

    } catch (error) {
        console.error('Adsets API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
