import fs from 'fs/promises';
import path from 'path';

/**
 * Service to sync Facebook Ad insights to local storage.
 * @param {number} months Number of months to sync back.
 * @returns {Promise<{success: boolean, syncedCount: number, message?: string, error?: string}>}
 */
export async function syncMarketingData(months = 3) {
    try {
        const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
        const AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;

        if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
            console.error('Facebook credentials not configured in environment');
            return { success: false, error: 'Facebook credentials not configured' };
        }

        // Adjust path based on execution context (Server vs API Route)
        // process.cwd() in Next.js usually points to project root
        // But let's be safe and use an absolute path relative to project root
        const logsDir = path.join(process.cwd(), 'marketing/logs/daily');
        await fs.mkdir(logsDir, { recursive: true });

        let totalSynced = 0;

        // Fetch in 30-day chunks
        for (let i = 0; i < Math.ceil(months * 30 / 30); i++) {
            const endOffset = i * 30;
            const startOffset = (i + 1) * 30;

            const timeRange = JSON.stringify({ since: getOffsetDate(startOffset), until: getOffsetDate(endOffset) });
            let url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach,cpc,cpm,ctr,actions,action_values&time_range=${timeRange}&time_increment=1&level=ad&limit=500&access_token=${ACCESS_TOKEN}`;

            while (url) {
                const response = await fetch(url);
                const data = await response.json();

                if (!response.ok) {
                    console.error(`FB Sync Error at chunk ${i}:`, data);
                    break;
                }

                const adLevelData = data.data || [];
                const hierarchy = {};

                for (const item of adLevelData) {
                    const date = item.date_start;
                    const campId = item.campaign_id;

                    if (!hierarchy[date]) hierarchy[date] = {};
                    if (!hierarchy[date][campId]) {
                        hierarchy[date][campId] = {
                            id: campId,
                            name: item.campaign_name,
                            spend: 0,
                            impressions: 0,
                            clicks: 0,
                            reach: 0,
                            actions: {},
                            action_values: {},
                            ads: []
                        };
                    }

                    const camp = hierarchy[date][campId];
                    const spend = parseFloat(item.spend || 0);
                    const impressions = parseInt(item.impressions || 0);
                    const clicks = parseInt(item.clicks || 0);
                    const reach = parseInt(item.reach || 0);

                    camp.ads.push({
                        id: item.ad_id,
                        name: item.ad_name,
                        adset_id: item.adset_id,
                        adset_name: item.adset_name,
                        spend,
                        impressions,
                        clicks,
                        reach,
                        actions: item.actions || [],
                        action_values: item.action_values || []
                    });

                    camp.spend += spend;
                    camp.impressions += impressions;
                    camp.clicks += clicks;
                    camp.reach += reach;

                    (item.actions || []).forEach(a => {
                        camp.actions[a.action_type] = (camp.actions[a.action_type] || 0) + parseInt(a.value || 0);
                    });
                    (item.action_values || []).forEach(a => {
                        camp.action_values[a.action_type] = (camp.action_values[a.action_type] || 0) + parseFloat(a.value || 0);
                    });
                }

                for (const [date, campaignsMap] of Object.entries(hierarchy)) {
                    const [year, month] = date.split('-');
                    const subDir = path.join(logsDir, year, month);
                    await fs.mkdir(subDir, { recursive: true });
                    const fileName = `${date}.json`;
                    const filePath = path.join(subDir, fileName);

                    const record = {
                        date,
                        account_id: AD_ACCOUNT_ID,
                        spend: 0,
                        impressions: 0,
                        clicks: 0,
                        reach: 0,
                        actions: [],
                        action_values: [],
                        campaigns: []
                    };

                    const totalActions = {};
                    const totalActionValues = {};

                    for (const camp of Object.values(campaignsMap)) {
                        const formattedCamp = {
                            ...camp,
                            actions: Object.entries(camp.actions).map(([action_type, value]) => ({ action_type, value })),
                            action_values: Object.entries(camp.action_values).map(([action_type, value]) => ({ action_type, value }))
                        };

                        record.campaigns.push(formattedCamp);
                        record.spend += camp.spend;
                        record.impressions += camp.impressions;
                        record.clicks += camp.clicks;
                        record.reach += camp.reach;

                        Object.entries(camp.actions).forEach(([type, val]) => {
                            totalActions[type] = (totalActions[type] || 0) + val;
                        });
                        Object.entries(camp.action_values).forEach(([type, val]) => {
                            totalActionValues[type] = (totalActionValues[type] || 0) + val;
                        });
                    }

                    record.actions = Object.entries(totalActions).map(([action_type, value]) => ({ action_type, value }));
                    record.action_values = Object.entries(totalActionValues).map(([action_type, value]) => ({ action_type, value }));
                    record.synced_at = new Date().toISOString();

                    await fs.writeFile(filePath, JSON.stringify(record, null, 2));

                    // Also save hourly snapshot
                    const now = new Date();
                    // Only save hourly snapshot if we are syncing the current month/today
                    // We check if the record date matches today's date
                    const todayStr = now.toISOString().split('T')[0];

                    if (date === todayStr) {
                        const hour = String(now.getHours()).padStart(2, '0');
                        const hourlyDir = path.join(process.cwd(), 'marketing/logs/hourly', year, month, date);
                        await fs.mkdir(hourlyDir, { recursive: true });
                        const hourlyFile = path.join(hourlyDir, `${hour}.json`);

                        // We save the same record, which contains the "Day-to-Date" cumulative data
                        // The frontend can later calculate "Hourly Performance" by subtracting (Hour N) - (Hour N-1)
                        await fs.writeFile(hourlyFile, JSON.stringify(record, null, 2));
                    }

                    totalSynced++;
                }

                url = data.paging?.next || null;
            }
        }

        return {
            success: true,
            syncedCount: totalSynced,
            message: `Deep sync complete. Captured ${totalSynced} daily records across ${months} months.`
        };

    } catch (error) {
        console.error('Marketing Sync Service Error:', error);
        return { success: false, error: 'Internal Server Error' };
    }
}

function getOffsetDate(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() - daysOffset);
    return d.toISOString().split('T')[0];
}
