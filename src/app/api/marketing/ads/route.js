import { NextResponse } from 'next/server';

/**
 * API Route to fetch all ads for the connected Facebook Ad Account
 */
export async function GET(request) {
    try {
        const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
        const AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;

        if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
            return NextResponse.json({ error: 'Facebook credentials not configured' }, { status: 400 });
        }

        // Fetch ads with basic info and thumbnails
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || 'maximum';
        const preset = range === 'last_30d' ? 'last_30d' : 'maximum';

        // Optimized query: Use date_preset for dynamic range data and include action_values for ROAS
        const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/ads?fields=name,status,campaign_id,adset_id,created_time,created_by,creative{thumbnail_url,image_url},insights.date_preset(${preset}){spend,impressions,cpm,ctr,cpc,clicks,actions,action_values,cost_per_action_type}&limit=200&access_token=${ACCESS_TOKEN}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('Facebook Ads API Error:', data);
            return NextResponse.json({
                success: false,
                error: data.error?.message || 'Failed to fetch ads',
                errorCode: data.error?.code
            }, { status: 500 });
        }

        // Simplify and flatten ad data
        const ads = (data.data || []).map(ad => ({
            id: ad.id,
            name: ad.name,
            status: ad.status,
            campaign_id: ad.campaign_id,
            adset_id: ad.adset_id,
            created_time: ad.created_time,
            updated_time: ad.updated_time,
            created_by: ad.created_by ? (ad.created_by.name || 'Unknown') : null,
            updated_by: ad.updated_by ? (ad.updated_by.name || 'Unknown') : null,

            thumbnail: ad.creative?.thumbnail_url || ad.creative?.image_url,
            image: ad.creative?.image_url || ad.creative?.thumbnail_url,
            creative_name: ad.creative?.name,
            // Latest insights from the core fields
            spend: parseFloat(ad.insights?.data?.[0]?.spend || 0),
            impressions: parseInt(ad.insights?.data?.[0]?.impressions || 0),
            cpm: parseFloat(ad.insights?.data?.[0]?.cpm || 0),
            ctr: parseFloat(ad.insights?.data?.[0]?.ctr || 0),
            cpc: parseFloat(ad.insights?.data?.[0]?.cpc || 0),
            clicks: parseInt(ad.insights?.data?.[0]?.clicks || 0),
            actions: ad.insights?.data?.[0]?.actions || [],
            action_values: ad.insights?.data?.[0]?.action_values || [],
            cost_per_action_type: ad.insights?.data?.[0]?.cost_per_action_type || []
        }));

        return NextResponse.json({
            success: true,
            data: ads
        });

    } catch (error) {
        console.error('Ads API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
