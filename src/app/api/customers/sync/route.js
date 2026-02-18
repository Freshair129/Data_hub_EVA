import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '../customer');

export async function POST() {
    try {
        const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
        const PAGE_ID = process.env.FB_PAGE_ID;

        if (!PAGE_ACCESS_TOKEN || !PAGE_ID) {
            return NextResponse.json({ error: 'Facebook credentials not configured' }, { status: 400 });
        }

        const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/conversations?fields=participants,updated_time&access_token=${PAGE_ACCESS_TOKEN}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.error) {
            throw new Error(result.error.message);
        }

        const conversations = result.data || [];
        let createdCount = 0;
        let skippedCount = 0;

        for (const conv of conversations) {
            const customer = conv.participants.data.find(p => p.id !== PAGE_ID);
            if (!customer) continue;

            const customerId = `fb_${customer.id}`;
            const customerDir = path.join(DATA_DIR, customerId);

            if (!fs.existsSync(customerDir)) {
                fs.mkdirSync(customerDir, { recursive: true });
            }

            const profilePath = path.join(customerDir, `profile_${customerId}.json`);

            if (fs.existsSync(profilePath)) {
                skippedCount++;
                continue;
            }

            const profile = {
                meta_schema_version: "1.0",
                customer_id: customerId,
                profile: {
                    first_name: customer.name.split(' ')[0] || "FB",
                    last_name: customer.name.split(' ').slice(1).join(' ') || "User",
                    nick_name: "",
                    job_title: "Facebook Lead",
                    company: "",
                    status: "Active",
                    membership_tier: "MEMBER",
                    lifecycle_stage: "Lead",
                    join_date: new Date().toISOString().split('T')[0]
                },
                contact_info: {
                    email: customer.email || "",
                    phone_primary: ""
                },
                social_profiles: {
                    facebook: {
                        id: customer.id,
                        name: customer.name,
                        last_interaction: conv.updated_time
                    }
                },
                intelligence: {
                    tags: ["Facebook Messenger", "Real Data"],
                    metrics: {
                        total_spend: 0,
                        total_order: 0
                    }
                },
                wallet: {
                    balance: 0,
                    currency: "THB",
                    points: 0
                },
                inventory: {
                    learning_courses: [],
                    coupons: []
                },
                timeline: [
                    {
                        id: `SYNC-${Date.now()}`,
                        date: conv.updated_time,
                        type: "CHAT",
                        summary: "Started conversation on Facebook Messenger",
                        details: { conversation_id: conv.id }
                    }
                ]
            };

            fs.writeFileSync(profilePath, JSON.stringify(profile, null, 4));
            createdCount++;
        }

        return NextResponse.json({
            success: true,
            created: createdCount,
            skipped: skippedCount,
            message: `Synced ${createdCount} new profiles, ${skippedCount} items already existed.`
        });

    } catch (error) {
        console.error('FB Sync API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
