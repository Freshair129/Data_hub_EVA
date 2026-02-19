import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const FB_PAGE_ID = process.env.FB_PAGE_ID;
const DATABASE_URL = process.env.DATABASE_URL;

if (!FB_PAGE_ACCESS_TOKEN || !FB_PAGE_ID || !DATABASE_URL) {
    console.error('❌ Missing required environment variables (FB_PAGE_ACCESS_TOKEN, FB_PAGE_ID, DATABASE_URL)');
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function getFBProfile(psid: string) {
    try {
        const res = await axios.get(`https://graph.facebook.com/v19.0/${psid}`, {
            params: {
                access_token: FB_PAGE_ACCESS_TOKEN,
                fields: 'id,first_name,last_name,profile_pic,gender,locale,timezone'
            }
        });
        return res.data;
    } catch (error) {
        console.warn(`  ⚠️ Could not fetch profile for PSID ${psid}:`, error.response?.data?.error?.message || error.message);
        return null;
    }
}

async function syncConversations() {
    console.log(`🚀 Starting Facebook Conversation Sync to Supabase for Page: ${FB_PAGE_ID}...`);

    try {
        let url = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/conversations?fields=id,updated_time,participants&limit=25`;
        let totalConversations = 0;

        while (url) {
            const res = await axios.get(url, { params: { access_token: FB_PAGE_ACCESS_TOKEN } });
            const conversations = res.data.data || [];

            for (const conv of conversations) {
                const participants = conv.participants?.data || [];
                const customerFB = participants.find(p => p.id !== FB_PAGE_ID);

                if (!customerFB) continue;

                const psid = customerFB.id;
                const customerName = customerFB.name;
                const customerId = `FB_CHAT_${psid}`;

                console.log(`👤 Processing Customer: ${customerName} (${psid})`);

                // 1. Fetch/Update Customer Profile
                const profile = await getFBProfile(psid);

                await prisma.customer.upsert({
                    where: { customerId: customerId },
                    update: {
                        firstName: profile?.first_name || customerName.split(' ')[0],
                        lastName: profile?.last_name || customerName.split(' ').slice(1).join(' '),
                        profilePicture: profile?.profile_pic,
                        facebookId: psid,
                        facebookName: customerName,
                        intelligence: { locale: profile?.locale, timezone: profile?.timezone, gender: profile?.gender, source: 'Facebook Messenger' }
                    },
                    create: {
                        customerId: customerId,
                        firstName: profile?.first_name || customerName.split(' ')[0],
                        lastName: profile?.last_name || customerName.split(' ').slice(1).join(' '),
                        profilePicture: profile?.profile_pic,
                        facebookId: psid,
                        facebookName: customerName,
                        status: 'Active',
                        intelligence: { locale: profile?.locale, timezone: profile?.timezone, gender: profile?.gender, source: 'Facebook Messenger' },
                        walletBalance: 0,
                        walletPoints: 0,
                        walletCurrency: 'THB'
                    }
                });

                // 2. Sync Conversation Node
                const dbConv = await prisma.conversation.upsert({
                    where: { conversationId: conv.id },
                    update: {
                        lastMessageAt: new Date(conv.updated_time),
                        participantName: customerName,
                        participantId: psid,
                        customer: { connect: { customerId: customerId } }
                    },
                    create: {
                        conversationId: conv.id,
                        channel: 'facebook',
                        participantName: customerName,
                        participantId: psid,
                        lastMessageAt: new Date(conv.updated_time),
                        customer: { connect: { customerId: customerId } }
                    }
                });

                // 3. Fetch Messages for this conversation
                console.log(`  📥 Fetching messages for ${conv.id}...`);
                const msgRes = await axios.get(`https://graph.facebook.com/v19.0/${conv.id}/messages`, {
                    params: {
                        access_token: FB_PAGE_ACCESS_TOKEN,
                        fields: 'id,created_time,from,to,message,attachments{id,mime_type,image_data,video_data,file_url}'
                    }
                });

                for (const msg of msgRes.data.data || []) {
                    const fromId = msg.from?.id;
                    const attachment = msg.attachments?.data?.[0];

                    await prisma.message.upsert({
                        where: { messageId: msg.id },
                        update: {}, // Messages don't change
                        create: {
                            messageId: msg.id,
                            conversation: { connect: { id: dbConv.id } },
                            fromId: fromId,
                            fromName: msg.from?.name,
                            content: msg.message,
                            hasAttachment: !!attachment,
                            attachmentType: attachment?.mime_type,
                            attachmentUrl: attachment?.image_data?.url || attachment?.video_data?.url || attachment?.file_url,
                            createdAt: new Date(msg.created_time)
                        }
                    });
                }

                totalConversations++;
            }

            url = res.data.paging?.next;
            if (totalConversations >= 50) break; // Limit to 50 for initial sync
        }

        console.log(`\n✨ Sync Completed! Processed ${totalConversations} conversations.`);
    } catch (error) {
        console.error('❌ Sync Failed:', error.response?.data || error.message);
    }
}

syncConversations()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
