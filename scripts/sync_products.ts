
import 'dotenv/config';
import { getPrisma } from '../src/lib/db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sync() {
    console.log('Starting product sync using src/lib/db.js...');

    // Explicitly load .env if needed, though getPrisma relies on process.env
    // tsx usually loads .env if present.

    const prisma = await getPrisma();

    if (!prisma) {
        console.error('Failed to initialize Prisma client via db.js');
        process.exit(1);
    }

    const productsDir = path.join(__dirname, '../../products');
    const results = [];

    // 1. Sync Packages
    const packagesDir = path.join(productsDir, 'packages');
    if (fs.existsSync(packagesDir)) {
        const files = fs.readdirSync(packagesDir).filter(f => f.endsWith('.json'));
        console.log(`Found ${files.length} packages.`);
        for (const file of files) {
            const res = await syncFile(prisma, path.join(packagesDir, file));
            console.log(res);
            results.push(res);
        }
    }

    // 2. Sync Courses
    const coursesDir = path.join(productsDir, 'courses');
    if (fs.existsSync(coursesDir)) {
        const files = fs.readdirSync(coursesDir).filter(f => f.endsWith('.json'));
        console.log(`Found ${files.length} courses.`);
        for (const file of files) {
            const res = await syncFile(prisma, path.join(coursesDir, file));
            console.log(res);
            results.push(res);
        }
    }

    console.log('Sync complete.');
    // Explicit disconnect not always needed if process exits, but good practice
    // prisma.$disconnect(); 
}

async function syncFile(prisma, filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);

        const productData = {
            productId: data.id,
            name: data.name,
            description: data.description || '',
            price: data.price,
            basePrice: data.base_price,
            image: data.image,
            category: data.category || 'course',
            duration: data.duration,
            durationUnit: data.duration_unit,
            metadata: data.metadata || {},
            isActive: true
        };

        const result = await prisma.product.upsert({
            where: { productId: data.id },
            update: productData,
            create: productData
        });

        return { file: path.basename(filePath), status: 'synced', id: result.productId };
    } catch (e) {
        return { file: path.basename(filePath), status: 'error', error: e.message };
    }
}

sync().catch(e => console.error(e));
