import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import {
    writeCustomerCache,
    writeCacheEntry,
    rebuildCustomerIndex,
    computeAnalyticsSummary
} from '../src/lib/cacheSync.js';
import { downloadAsset, getLocalAssetPath } from '../src/lib/assetDownloader.js';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🚀 Starting Full Database Clone to Local Cache...');

    try {
        // 1. Fetch all data
        console.log('📦 Fetching data from remote database...');

        const customers = await prisma.customer.findMany({
            include: {
                orders: {
                    include: { transactions: true }
                },
                timeline: true,
                inventory: true,
                cart: {
                    include: { product: true }
                },
                conversations: {
                    include: { messages: true }
                }
            }
        });

        const products = await prisma.product.findMany();
        const employees = await prisma.employee.findMany();

        // Fetch Marketing Structure
        const campaigns = await prisma.campaign.findMany();
        const adSets = await prisma.adSet.findMany();
        const ads = await prisma.ad.findMany();
        const creatives = await prisma.adCreative.findMany();
        const dailyMetrics = await prisma.adDailyMetric.findMany();

        console.log(`✅ Fetched Struct: ${customers.length} Customers, ${products.length} Products, ${employees.length} Employees`);
        console.log(`✅ Fetched Marketing: ${campaigns.length} Campaigns, ${adSets.length} AdSets, ${ads.length} Ads, ${creatives.length} Creatives`);

        // 2. Sync Products & Employees
        console.log('🛒 Syncing Products & Employees...');
        for (const product of products) writeCacheEntry('products', product.productId, product);
        for (const employee of employees) writeCacheEntry('employee', employee.employeeId, employee);

        // 3. Sync Marketing Structure
        console.log('📊 Syncing Marketing Structure...');
        for (const camp of campaigns) writeCacheEntry('ads/campaign', camp.campaignId, camp);
        for (const set of adSets) writeCacheEntry('ads/ad_set', set.adSetId, set);
        for (const ad of ads) writeCacheEntry('ads/ad', ad.adId, ad);

        for (const creative of creatives) {
            writeCacheEntry('ads/creative', creative.id, creative);
            if (creative.imageUrl) {
                const localPath = path.join(process.cwd(), 'cache', 'ads', 'creative', 'assets', `${creative.id}.jpg`);
                ensureDir(localPath);
                await downloadAsset(creative.imageUrl, localPath);
            }
        }

        // 4. Sync Customers & Assets
        console.log('👤 Syncing Customers & Assets...');
        for (const customer of customers) {
            const customerId = customer.customerId;
            await writeCustomerCache(customerId, customer);

            // Timeline
            if (customer.timeline && customer.timeline.length > 0) {
                writeCacheEntry(`customer/${customerId}/timeline`, 'all', { events: customer.timeline });
            }

            // Conversations
            if (customer.conversations) {
                for (const conv of customer.conversations) {
                    writeCacheEntry(`customer/${customerId}/chathistory`, conv.conversationId, conv);
                }
            }

            // Profile Picture
            if (customer.profilePicture) {
                const localRelPath = getLocalAssetPath(customerId, customer.profilePicture, 'images');
                const fullLocalPath = path.join(process.cwd(), 'cache', 'customer', customerId, localRelPath);
                await downloadAsset(customer.profilePicture, fullLocalPath);
            }

            // Slip Images from Transactions
            for (const order of customer.orders || []) {
                for (const tx of order.transactions || []) {
                    if (tx.slipImageUrl) {
                        const localRelPath = getLocalAssetPath(customerId, tx.slipImageUrl, 'images');
                        const fullLocalPath = path.join(process.cwd(), 'cache', 'customer', customerId, localRelPath);
                        await downloadAsset(tx.slipImageUrl, fullLocalPath);
                    }
                }
            }
        }

        // 5. Rebuild Indices & Reports
        console.log('📋 Rebuilding indices and analytics...');
        await rebuildCustomerIndex();

        const allOrders = await prisma.order.findMany();
        await computeAnalyticsSummary(customers, allOrders);

        // Rebuild marketing metrics from daily records
        // Note: rebuildMarketingMetrics is exported from cacheSync.js
        const { rebuildMarketingMetrics } = await import('../src/lib/cacheSync.js');
        await rebuildMarketingMetrics(dailyMetrics);

        console.log('✨ Full Clone Complete!');

    } catch (error) {
        console.error('❌ Clone failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

function ensureDir(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

main();
