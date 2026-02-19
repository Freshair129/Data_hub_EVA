import { NextResponse } from 'next/server';
import { readCacheEntry, writeCacheEntry } from '@/lib/cacheSync';

/**
 * API Route to fetch real Facebook Campaigns with per-campaign insights
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
        const preset = range === 'last_30d' ? 'last_30d' :
            range === 'last_7d' ? 'last_7d' :
                range === 'today' ? 'today' : 'maximum';

        // ── Cache-First: campaigns are keyed by date range (15 min TTL) ──
        const cacheId = `campaigns_${preset}`;
        const cached = readCacheEntry('ads/campaign', cacheId);
        if (cached) {
            console.log(`[Campaigns] 🗃 Serving from cache (range: ${preset})`);
            setImmediate(() => _fetchAndCacheCampaigns(ACCESS_TOKEN, AD_ACCOUNT_ID, preset, cacheId).catch(console.error));
            return NextResponse.json({ ...cached, _source: 'cache' });
        }


        // ── Cache Miss: fetch from Facebook ──
        return NextResponse.json(await _fetchAndCacheCampaigns(ACCESS_TOKEN, AD_ACCOUNT_ID, preset, cacheId));

    } catch (error) {
        console.error('Marketing API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

async function _fetchAndCacheCampaigns(ACCESS_TOKEN, AD_ACCOUNT_ID, preset, cacheId) {
    const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns?fields=name,status,objective,start_time,stop_time,daily_budget,lifetime_budget,insights.date_preset(${preset}){spend,impressions,clicks,reach,cpc,cpm,ctr,actions,action_values,cost_per_action_type}&limit=50&access_token=${ACCESS_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        console.error('Facebook API Error:', data);
        if (data.error?.code === 190) {
            return { success: false, errorType: 'TOKEN_EXPIRED', error: 'Facebook access token has expired or is invalid.' };
        }
        return { error: data.error?.message || 'Failed to fetch campaigns' };
    }

    const campaigns = (data.data || []).map(campaign => {
        const ins = campaign.insights?.data?.[0] || {};
        return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            start_time: campaign.start_time,
            stop_time: campaign.stop_time,
            daily_budget: campaign.daily_budget ? Number(campaign.daily_budget) / 100 : null,
            lifetime_budget: campaign.lifetime_budget ? Number(campaign.lifetime_budget) / 100 : null,
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

    const payload = { success: true, data: campaigns };

    // Cache full list by range key, and each campaign individually
    writeCacheEntry('ads/campaign', cacheId, payload);
    for (const c of campaigns) {
        writeCacheEntry('ads/campaign', c.id, c);
    }

    return payload;
}
