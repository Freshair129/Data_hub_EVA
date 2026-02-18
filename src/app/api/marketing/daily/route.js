import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * API Route to fetch daily Facebook Ads insights for trend charts
 * Merges local historical logs with live API data
 */
export async function GET() {
    try {
        const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
        const AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;

        // 1. Fetch Local Logs (supports YYYY/MM subfolder structure)
        let allDaily = [];
        const logsDir = path.join(process.cwd(), '../marketing/logs/daily');

        async function readLogsRecursive(dir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        await readLogsRecursive(fullPath);
                    } else if (entry.name.endsWith('.json')) {
                        const content = await fs.readFile(fullPath, 'utf-8');
                        allDaily.push(JSON.parse(content));
                    }
                }
            } catch (e) {
                // Ignore if directory doesn't exist
            }
        }

        try {
            await readLogsRecursive(logsDir);
        } catch (e) {
            console.warn('No local logs found or error reading logs:', e.message);
        }

        // 2. Fetch Live Data (Last 30 days)
        if (ACCESS_TOKEN && AD_ACCOUNT_ID) {
            const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,reach,cpc,cpm,ctr,actions,action_values&date_preset=last_30d&time_increment=1&access_token=${ACCESS_TOKEN}`;

            try {
                const response = await fetch(url);
                const data = await response.json();

                if (response.ok && data.data) {
                    data.data.forEach(day => {
                        const existingIdx = allDaily.findIndex(d => d.date === day.date_start);
                        const record = {
                            date: day.date_start,
                            spend: parseFloat(day.spend || 0),
                            impressions: parseInt(day.impressions || 0),
                            clicks: parseInt(day.clicks || 0),
                            reach: parseInt(day.reach || 0),
                            cpc: parseFloat(day.cpc || 0),
                            cpm: parseFloat(day.cpm || 0),
                            ctr: parseFloat(day.ctr || 0),
                            actions: day.actions || [],
                            action_values: day.action_values || []
                        };


                        if (existingIdx >= 0) {
                            // Update with latest live data but preserve local details (campaigns/ads)
                            allDaily[existingIdx] = {
                                ...allDaily[existingIdx],
                                ...record
                            };
                        } else {
                            allDaily.push(record);
                        }
                    });
                } else if (!response.ok) {
                    console.warn('Facebook Daily API Error:', data.error?.message);
                    if (data.error?.code === 190 || data.error?.type === 'OAuthException') {
                        return NextResponse.json({
                            success: false,
                            errorType: 'TOKEN_EXPIRED',
                            error: 'Facebook Access Token has expired.'
                        }, { status: 401 });
                    }
                }
            } catch (err) {
                console.error('Error fetching live daily data:', err);
            }
        }

        // 3. Sort and Filter (Keep last 3 years for client)
        const sortedDaily = allDaily
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(-1110); // Support 3-year history (approx 37 months)

        console.log(`[Daily API] Returning ${sortedDaily.length} records.`);
        if (sortedDaily.length > 0) {
            console.log('[Daily API] First record:', sortedDaily[0]);
            console.log('[Daily API] Last record:', sortedDaily[sortedDaily.length - 1]);
        }

        return NextResponse.json({
            success: true,
            data: sortedDaily
        });

    } catch (error) {
        console.error('Daily Insights API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
