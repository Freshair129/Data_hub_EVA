import { NextResponse } from 'next/server';
import { readCacheEntry } from '@/lib/cacheSync';

/**
 * Marketing Overview API - Returns high-level KPIs for Dashboard
 */
export async function GET() {
    try {
        // 1. Read Analytics Summary (Customers, Revenue)
        const summary = readCacheEntry('analytics', 'summary');

        // 2. Read Marketing Totals (Ad Spend, Leads, ROI)
        // Note: For now we return what we have, but we could add more specific aggregation logic here
        const adSummary = readCacheEntry('ads/campaign', 'campaigns_maximum') || { data: [] };

        const marketingKPIs = adSummary.data.reduce((acc, c) => {
            acc.spend += c.spend || 0;
            acc.impressions += c.impressions || 0;
            acc.clicks += c.clicks || 0;
            acc.leads += c.leads || 0;
            acc.purchases += c.purchases || 0;
            return acc;
        }, { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0 });

        const payload = {
            success: true,
            _cachedAt: new Date().toISOString(),
            kpis: {
                totalCustomers: summary?.customers?.total || 0,
                newCustomersThisMonth: summary?.customers?.newThisMonth || 0,
                totalRevenue: summary?.revenue?.total || 0,
                revenueThisMonth: summary?.revenue?.thisMonth || 0,
                adSpend: marketingKPIs.spend,
                adLeads: marketingKPIs.leads,
                roas: marketingKPIs.spend > 0 ? (summary?.revenue?.total / marketingKPIs.spend).toFixed(2) : 0,
            },
            summary: summary || null
        };

        return NextResponse.json(payload);

    } catch (error) {
        console.error('GET /api/marketing/overview error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
