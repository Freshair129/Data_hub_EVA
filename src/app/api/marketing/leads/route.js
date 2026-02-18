import { NextResponse } from 'next/server';

/**
 * API Route to fetch real Facebook Leads for the ad account
 */
export async function GET() {
    try {
        const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
        const AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;

        if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
            return NextResponse.json({ error: 'Facebook credentials not configured' }, { status: 400 });
        }

        // Fetch leads directly from the ad account
        // Fields: created_time, id, ad_id, form_id, field_data
        const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/leads?fields=created_time,id,ad_id,ad_name,form_id,field_data&limit=100&access_token=${ACCESS_TOKEN}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('Facebook Leads API Error:', data);
            return NextResponse.json({ error: data.error?.message || 'Failed to fetch leads' }, { status: 500 });
        }

        // Process leads to extract field_data into a cleaner format
        const processedLeads = (data.data || []).map(lead => {
            const mappedData = {};
            lead.field_data.forEach(field => {
                const name = field.name.toLowerCase();
                const value = field.values?.[0] || '';

                // Map common fields to standard CRM names
                if (name.includes('name')) mappedData.name = value;
                if (name.includes('email')) mappedData.email = value;
                if (name.includes('phone')) mappedData.phone = value;
                if (name.includes('city')) mappedData.city = value;
            });

            return {
                customer_id: `FB-${lead.id}`,
                name: mappedData.name || 'Facebook User',
                email: mappedData.email || '',
                phone: mappedData.phone || '',
                city: mappedData.city || '',
                source: `Facebook Ads (${lead.ad_name || lead.ad_id})`,
                created_at: lead.created_time,
                facebook_lead_id: lead.id,
                status: 'New Lead',
                history: [
                    {
                        date: lead.created_time,
                        event: 'Lead Captured',
                        details: `Captured via Facebook Ad: ${lead.ad_name || lead.ad_id}`
                    }
                ],
                metrics: {
                    total_spent: 0,
                    avg_order: 0,
                    purchase_count: 0,
                    churn_risk_level: 'Low'
                },
                tags: ['Facebook Lead', 'AI Target']
            };
        });

        return NextResponse.json({
            success: true,
            data: processedLeads
        });

    } catch (error) {
        console.error('Leads API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
