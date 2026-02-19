import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('📊 Current Database Stats:');
    try {
        const counts = {
            customers: await prisma.customer.count(),
            campaigns: await prisma.campaign.count(),
            adSets: await prisma.adSet.count(),
            ads: await prisma.ad.count(),
            creatives: await prisma.adCreative.count(),
            timelineEvents: await prisma.timelineEvent.count()
        };
        console.table(counts);
    } catch (err) {
        console.error('❌ Error checking counts:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
