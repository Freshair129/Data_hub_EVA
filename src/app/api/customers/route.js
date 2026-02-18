import { NextResponse } from 'next/server';
import { getAllCustomers, upsertCustomer } from '@/lib/db';

/**
 * GET Customers - Now syncs with Facebook Leads automatically
 */
export async function GET() {
    try {
        const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
        const PAGE_ID = process.env.FB_PAGE_ID;
        const AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;
        const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

        // 1. Sync Customers from Facebook Conversations (Chat)
        if (PAGE_ACCESS_TOKEN && PAGE_ID) {
            try {
                // Step A: Fetch conversations with participant details and labels
                const convUrl = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=participants,updated_time,labels,messages.limit(3){from,message,created_time}&limit=100&access_token=${PAGE_ACCESS_TOKEN}`;
                const convRes = await fetch(convUrl);
                const convData = await convRes.json();

                if (convRes.ok && convData.data) {
                    for (const conv of convData.data) {
                        const customer = conv.participants?.data?.find(p => p.id !== PAGE_ID);
                        if (!customer) continue;

                        const customerId = `MSG-${customer.id}`;
                        const messages = conv.messages?.data || [];
                        const hasStaffReply = messages.some(m => m.from.id !== customer.id);

                        // Get the name of the agent/page from the last staff message
                        let detectedAgent = 'Unassigned';
                        if (hasStaffReply) {
                            const lastStaffMsg = messages.find(m => m.from.id !== customer.id);
                            if (lastStaffMsg) detectedAgent = lastStaffMsg.from.name;
                        }

                        // Extract Labels from Facebook
                        const fbLabels = conv.labels?.data?.map(l => l.name) || [];

                        // Load existing profile via Adapter to preserve data
                        let existing = await getAllCustomers().then(all => all.find(c => c.customer_id === customerId));

                        const profileUpdate = {
                            customer_id: customerId,
                            conversation_id: conv.id,
                            profile: {
                                first_name: existing?.profile?.first_name || customer.name?.split(' ')[0] || 'Facebook',
                                last_name: existing?.profile?.last_name || customer.name?.split(' ').slice(1).join(' ') || 'User',
                                status: existing?.profile?.status || 'Active',
                                membership_tier: existing?.profile?.membership_tier || 'GENERAL',
                                lifecycle_stage: existing?.profile?.lifecycle_stage || (hasStaffReply ? 'In Progress' : 'New Lead'),
                                agent: existing?.profile?.agent && existing.profile.agent !== 'Unassigned' ? existing.profile.agent : detectedAgent,
                                join_date: existing?.profile?.join_date || conv.updated_time || new Date().toISOString()
                            },
                            contact_info: {
                                facebook: customer.name,
                                facebook_id: customer.id,
                                lead_channel: 'Facebook'
                            },
                            intelligence: {
                                metrics: existing?.intelligence?.metrics || { total_spend: 0, total_order: 0 },
                                tags: Array.from(new Set([...(existing?.intelligence?.tags || []), 'Facebook Chat', ...fbLabels]))
                            }
                        };

                        await upsertCustomer(profileUpdate);
                    }
                }
            } catch (e) {
                console.error('[Sync] Conversation Sync Error:', e.message);
            }
        }

        // 2. Fetch all customers via Adapter (JSON/PG/Supabase)
        const customers = await getAllCustomers();
        return NextResponse.json(customers);

    } catch (error) {
        console.error('GET /api/customers error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/customers - Save or Update Customer
 */
export async function POST(request) {
    try {
        const customerData = await request.json();
        if (!customerData.customer_id) {
            return NextResponse.json({ error: 'Missing customer_id' }, { status: 400 });
        }

        const result = await upsertCustomer(customerData);
        return NextResponse.json({ success: true, customer: result });

    } catch (error) {
        console.error('POST /api/customers error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
