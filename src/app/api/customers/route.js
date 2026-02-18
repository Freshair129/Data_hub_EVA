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
                        // Standard ID Resolution (TVS-CUS V7)
                        const allExisting = await getAllCustomers();
                        let targetCustomer = allExisting.find(c =>
                            c.contact_info?.facebook_id === customer.id ||
                            c.facebook_id === customer.id
                        );

                        let customerId = targetCustomer?.customer_id;

                        if (!customerId) {
                            // Generate new TVS-CUS-FB-26-XXXX
                            const currentYearShort = new Date().getFullYear().toString().slice(-2);
                            const fbCustomers = allExisting.filter(c => c.customer_id?.startsWith(`TVS-CUS-FB-${currentYearShort}-`));
                            const maxSerial = fbCustomers.reduce((max, c) => {
                                const num = parseInt(c.customer_id.split('-').pop());
                                return num > max ? num : max;
                            }, 0);
                            customerId = `TVS-CUS-FB-${currentYearShort}-${String(maxSerial + 1).padStart(4, '0')}`;
                            console.log(`[Sync] Assigning new standardized ID: ${customerId} for Facebook User ${customer.id}`);
                        }

                        const profileUpdate = {
                            customer_id: customerId,
                            conversation_id: conv.id,
                            profile: {
                                first_name: targetCustomer?.profile?.first_name || customer.name?.split(' ')[0] || 'Facebook',
                                last_name: targetCustomer?.profile?.last_name || customer.name?.split(' ').slice(1).join(' ') || 'User',
                                status: targetCustomer?.profile?.status || 'Active',
                                membership_tier: targetCustomer?.profile?.membership_tier || 'GENERAL',
                                lifecycle_stage: targetCustomer?.profile?.lifecycle_stage || (hasStaffReply ? 'In Progress' : 'New Lead'),
                                agent: targetCustomer?.profile?.agent && targetCustomer.profile.agent !== 'Unassigned' ? targetCustomer.profile.agent : detectedAgent,
                                join_date: targetCustomer?.profile?.join_date || conv.updated_time || new Date().toISOString()
                            },
                            contact_info: {
                                facebook: customer.name,
                                facebook_id: customer.id,
                                lead_channel: 'Facebook'
                            },
                            intelligence: {
                                metrics: targetCustomer?.intelligence?.metrics || { total_spend: 0, total_order: 0 },
                                tags: Array.from(new Set([...(targetCustomer?.intelligence?.tags || []), 'Facebook Chat', ...fbLabels]))
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
