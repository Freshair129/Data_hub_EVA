import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const FB_AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;
const DATABASE_URL = process.env.DATABASE_URL;

if (!FB_ACCESS_TOKEN || !FB_AD_ACCOUNT_ID || !DATABASE_URL) {
    console.error('❌ Missing required environment variables (FB_ACCESS_TOKEN, FB_AD_ACCOUNT_ID, DATABASE_URL)');
    process.exit(1);
}

// Prisma Setup
const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

async function fetchLeads() {
    console.log(`📦 Fetching leads for Page: ${FB_PAGE_ID}...`);
    if (!FB_PAGE_ACCESS_TOKEN) {
        console.error('❌ Missing FB_PAGE_ACCESS_TOKEN');
        return [];
    }
    try {
        // 1. Get Lead Forms from the PAGE node
        const formsRes = await axios.get(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/leadgen_forms`, {
            params: { access_token: FB_PAGE_ACCESS_TOKEN, fields: 'id,name' }
        });

        const forms = formsRes.data.data || [];
        console.log(`  - Found ${forms.length} lead forms.`);

        const allLeads = [];
        for (const form of forms) {
            console.log(`  - Checking form: ${form.name} (${form.id})`);
            const leadsRes = await axios.get(`https://graph.facebook.com/v19.0/${form.id}/leads`, {
                params: {
                    access_token: FB_PAGE_ACCESS_TOKEN,
                    fields: 'id,created_time,field_data,ad_id,adset_id,campaign_id'
                }
            });
            allLeads.push(...(leadsRes.data.data || []));
        }

        console.log(`  - Total leads found across all forms: ${allLeads.length}`);
        return allLeads;
    } catch (error) {
        console.error('❌ Error fetching leads:', error.response?.data || error.message);
        return [];
    }
}

async function getAdDetails(adId: string) {
    try {
        const res = await axios.get(`https://graph.facebook.com/v19.0/${adId}`, {
            params: {
                access_token: FB_ACCESS_TOKEN,
                fields: 'name,creative{id,name,thumbnail_url,image_url},adset{id,name},campaign{id,name}'
            }
        });
        return res.data;
    } catch (error) {
        return null;
    }
}

async function getFBProfile(fbUserId: string) {
    try {
        // Note: Needs Page Access Token usually if via Messenger, but let's try Graph
        const res = await axios.get(`https://graph.facebook.com/v19.0/${fbUserId}`, {
            params: {
                access_token: process.env.FB_PAGE_ACCESS_TOKEN || FB_ACCESS_TOKEN,
                fields: 'id,first_name,last_name,profile_pic,gender'
            }
        });
        return res.data;
    } catch (error) {
        return null;
    }
}

function extractField(fieldData: any[], name: string) {
    const field = fieldData.find(f => f.name === name || f.name.includes(name));
    return field ? field.values[0] : null;
}

async function syncMarketingMetadata() {
    console.log(`📊 Syncing Marketing Metadata for Account: ${FB_AD_ACCOUNT_ID}...`);
    try {
        // 1. Ensure AdAccount exists
        await prisma.adAccount.upsert({
            where: { accountId: FB_AD_ACCOUNT_ID },
            update: { name: 'V School Marketing' },
            create: { accountId: FB_AD_ACCOUNT_ID, name: 'V School Marketing', currency: 'THB' }
        });

        // 2. Fetch Campaigns
        const campFields = 'id,name,status,objective,start_time,stop_time,insights{spend,impressions,clicks}';
        const campRes = await axios.get(`https://graph.facebook.com/v19.0/${FB_AD_ACCOUNT_ID}/campaigns`, {
            params: { access_token: FB_ACCESS_TOKEN, fields: campFields }
        });

        for (const camp of campRes.data.data || []) {
            const insights = camp.insights?.data?.[0] || {};
            await prisma.campaign.upsert({
                where: { campaignId: camp.id },
                update: {
                    name: camp.name,
                    status: camp.status,
                    objective: camp.objective,
                    spend: parseFloat(insights.spend || '0'),
                    impressions: parseInt(insights.impressions || '0'),
                    clicks: parseInt(insights.clicks || '0'),
                    startDate: camp.start_time ? new Date(camp.start_time) : null,
                    endDate: camp.stop_time ? new Date(camp.stop_time) : null,
                    adAccountId: (await prisma.adAccount.findUnique({ where: { accountId: FB_AD_ACCOUNT_ID } }))?.id
                },
                create: {
                    campaignId: camp.id,
                    name: camp.name,
                    status: camp.status,
                    objective: camp.objective,
                    spend: parseFloat(insights.spend || '0'),
                    impressions: parseInt(insights.impressions || '0'),
                    clicks: parseInt(insights.clicks || '0'),
                    startDate: camp.start_time ? new Date(camp.start_time) : null,
                    endDate: camp.stop_time ? new Date(camp.stop_time) : null,
                    adAccount: { connect: { accountId: FB_AD_ACCOUNT_ID } }
                }
            });

            // 3. Fetch AdSets for this campaign
            const adSetRes = await axios.get(`https://graph.facebook.com/v19.0/${camp.id}/adsets`, {
                params: { access_token: FB_ACCESS_TOKEN, fields: 'id,name,status,daily_budget,targeting' }
            });

            for (const adset of adSetRes.data.data || []) {
                await prisma.adSet.upsert({
                    where: { adSetId: adset.id },
                    update: {
                        name: adset.name,
                        status: adset.status,
                        dailyBudget: parseFloat(adset.daily_budget || '0') / 100, // FB returns in cents usually but check
                        targeting: adset.targeting,
                        campaignId: (await prisma.campaign.findUnique({ where: { campaignId: camp.id } }))?.id
                    },
                    create: {
                        adSetId: adset.id,
                        name: adset.name,
                        status: adset.status,
                        dailyBudget: parseFloat(adset.daily_budget || '0') / 100,
                        targeting: adset.targeting,
                        campaign: { connect: { campaignId: camp.id } }
                    }
                });

                // 4. Fetch Ads for this AdSet
                const adRes = await axios.get(`https://graph.facebook.com/v19.0/${adset.id}/ads`, {
                    params: { access_token: FB_ACCESS_TOKEN, fields: 'id,name,status,creative{id,name,thumbnail_url},insights{spend,impressions,clicks}' }
                });

                for (const ad of adRes.data.data || []) {
                    const adInsights = ad.insights?.data?.[0] || {};
                    const creative = ad.creative;

                    // Sync Creative
                    if (creative) {
                        await prisma.adCreative.upsert({
                            where: { id: creative.id }, // Corrected: creative.id is unique in FB
                            update: { name: creative.name || 'Ad Creative', imageUrl: creative.thumbnail_url },
                            create: { id: creative.id, name: creative.name || 'Ad Creative', imageUrl: creative.thumbnail_url }
                        });
                    }

                    await prisma.ad.upsert({
                        where: { adId: ad.id },
                        update: {
                            name: ad.name,
                            status: ad.status,
                            spend: parseFloat(adInsights.spend || '0'),
                            impressions: parseInt(adInsights.impressions || '0'),
                            clicks: parseInt(adInsights.clicks || '0'),
                            adSet: { connect: { adSetId: adset.id } },
                            creative: creative ? { connect: { id: creative.id } } : undefined
                        },
                        create: {
                            adId: ad.id,
                            name: ad.name,
                            status: ad.status,
                            spend: parseFloat(adInsights.spend || '0'),
                            impressions: parseInt(adInsights.impressions || '0'),
                            clicks: parseInt(adInsights.clicks || '0'),
                            adSet: { connect: { adSetId: adset.id } },
                            creative: creative ? { connect: { id: creative.id } } : undefined
                        }
                    });
                }
            }
        }
        console.log('✅ Marketing Metadata Sync Completed.');
    } catch (error) {
        console.error('❌ Error syncing marketing metadata:', error.response?.data || error.message);
    }
}

async function syncLeads() {
    console.log('🚀 Starting Facebook "Student 360" Sync to Supabase...');

    // 1. Sync Structural Data First
    await syncMarketingMetadata();

    // 2. Sync Leads
    const leads = await fetchLeads();
    if (leads.length === 0) {
        console.log('⚠️ No leads found or retrieval failed. Check permissions.');
    }

    let syncedCount = 0;
    for (const lead of leads) {
        try {
            const email = extractField(lead.field_data, 'email');
            const phone = extractField(lead.field_data, 'phone') || extractField(lead.field_data, 'เบอร์โทร');
            const fullName = extractField(lead.field_data, 'full_name') || extractField(lead.field_data, 'ชื่อ');

            if (!email && !phone) continue;

            const customerId = `FB_${lead.id}`;
            const adInfo = lead.ad_id ? await getAdDetails(lead.ad_id) : null;

            const metadata = {
                fbLeadId: lead.id,
                fbFormId: lead.form_id,
                attribution: adInfo ? {
                    campaign: adInfo.campaign?.name,
                    adSet: adInfo.adset?.name,
                    adName: adInfo.name,
                    creativeThumbnail: adInfo.creative?.thumbnail_url || adInfo.creative?.image_url
                } : null,
                customFields: lead.field_data
            };

            await prisma.customer.upsert({
                where: { customerId: customerId },
                update: {
                    email: email || undefined,
                    phonePrimary: phone || undefined,
                    firstName: fullName?.split(' ')[0] || fullName,
                    lastName: fullName?.split(' ').slice(1).join(' ') || '',
                    profilePicture: metadata.attribution?.creativeThumbnail,
                    intelligence: { source: 'Facebook Lead Ads' },
                },
                create: {
                    customerId: customerId,
                    email: email || '',
                    phonePrimary: phone || '',
                    firstName: fullName?.split(' ')[0] || fullName || 'FB Lead',
                    lastName: fullName?.split(' ').slice(1).join(' ') || '',
                    profilePicture: metadata.attribution?.creativeThumbnail,
                    joinDate: new Date(lead.created_time),
                    status: 'NEW',
                    intelligence: { source: 'Facebook Lead Ads' },
                    walletBalance: 0,
                    walletPoints: 0,
                    walletCurrency: 'THB'
                }
            });

            await prisma.timelineEvent.create({
                data: {
                    eventId: `FB-LEAD-${lead.id}`,
                    customerId: (await prisma.customer.findUnique({ where: { customerId } }))?.id,
                    type: 'MARKETING_LEAD',
                    summary: 'New Facebook Lead',
                    details: {
                        message: `Joined via form from campaign: ${adInfo?.campaign?.name || 'Unknown'}`,
                        ...metadata
                    },
                    date: new Date(lead.created_time),
                }
            });

            syncedCount++;
            if (syncedCount % 10 === 0) console.log(`  - Synced ${syncedCount} customers...`);

        } catch (err) {
            console.error(`❌ Failed to sync lead ${lead.id}:`, err.message);
        }
    }

    console.log(`\n✨ Sync Completed! Total Leads Synced: ${syncedCount}`);
}

syncLeads()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
