import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import BusinessAnalyst from '@/utils/BusinessAnalyst';

// Helper to read JSON files safely
const readJsonFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
    }
    return null;
};

export async function GET(request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Gemini API Key missing' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customerId');

        if (!customerId) {
            return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 });
        }

        const DATA_DIR = path.join(process.cwd(), '../customer');
        let convFile = path.join(DATA_DIR, customerId, `conv_${customerId}.json`);

        // If not found directly (maybe customerId is a Conversation ID), search for it
        if (!fs.existsSync(convFile)) {
            console.log(`[AI] Direct path failed for ${customerId}. Searching...`);
            const folders = fs.readdirSync(DATA_DIR);
            let found = false;
            for (const folder of folders) {
                const searchPath = path.join(DATA_DIR, folder, 'chathistory', `conv_${customerId}.json`);
                if (fs.existsSync(searchPath)) {
                    convFile = searchPath;
                    found = true;
                    break;
                }
            }

            if (!found) {
                return NextResponse.json({ success: false, error: 'Conversation history not found' }, { status: 404 });
            }
        }

        const convoData = readJsonFile(convFile);
        const messages = (convoData?.messages || []).slice(-20); // Last 20 messages for context

        if (messages.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        // 1. Initialize Business Analyst AI
        const analyst = new BusinessAnalyst(apiKey);

        // 2. Extract Products from Chat
        const extracted = await analyst.extractProductsFromChat(messages);

        // 3. Match against Catalog
        // 3. Match against Catalog (Read from products directory)
        const productsDir = path.join(process.cwd(), '../products');
        let allCatalogItems = [];

        if (fs.existsSync(productsDir)) {
            const packagesDir = path.join(productsDir, 'packages');
            if (fs.existsSync(packagesDir)) {
                fs.readdirSync(packagesDir)
                    .filter(f => f.endsWith('.json'))
                    .forEach(f => {
                        try {
                            const data = JSON.parse(fs.readFileSync(path.join(packagesDir, f), 'utf8'));
                            allCatalogItems.push(data);
                        } catch (e) { }
                    });
            }
            const coursesDir = path.join(productsDir, 'courses');
            if (fs.existsSync(coursesDir)) {
                fs.readdirSync(coursesDir)
                    .filter(f => f.endsWith('.json'))
                    .forEach(f => {
                        try {
                            const data = JSON.parse(fs.readFileSync(path.join(coursesDir, f), 'utf8'));
                            allCatalogItems.push(data);
                        } catch (e) { }
                    });
            }
        }

        const enriched = extracted.map(item => {
            const match = allCatalogItems.find(p =>
                p.name.toLowerCase().includes(item.product_name.toLowerCase()) ||
                item.product_name.toLowerCase().includes(p.name.toLowerCase())
            );

            return {
                ...item,
                exists: !!match,
                catalog_id: match?.id || null,
                current_catalog_price: match?.price || null
            };
        });

        return NextResponse.json({
            success: true,
            data: enriched,
            customerId
        });

    } catch (error) {
        console.error('Product Discovery Failed:', error);
        return NextResponse.json({ success: false, error: 'Discovery failed' }, { status: 500 });
    }
}

/**
 * POST to actually add a product to the catalog
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { product_name, price, category } = body;

        if (!product_name || !price) {
            return NextResponse.json({ success: false, error: 'Missing product details' }, { status: 400 });
        }

        const productsDir = path.join(process.cwd(), '../products');

        // Determine file path based on type (assuming product for now as per original code)
        // Original code pushed to catalog.products. We will write to products/courses/ID.json
        // NOTE: The original code logic for 'category' defaulting to 'japan' suggests these are courses.
        // If we want to support packages, we need more logic, but for "product_name" it usually implies a course/menu.

        const cleanName = product_name.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
        const newId = `TVS-NEW-${cleanName}-${Date.now().toString().slice(-4)}`;

        const newProduct = {
            id: newId,
            name: product_name,
            description: `Auto-detected from chat.`,
            price: Number(price),
            base_price: Number(price),
            image: null,
            category: category?.toLowerCase() || 'japan',
            metadata: {
                level: "Basic",
                difficulty: "Beginner",
                auto_created: true,
                created_at: new Date().toISOString()
            }
        };

        const targetDir = path.join(productsDir, 'courses');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.join(targetDir, `${newId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(newProduct, null, 4));


        return NextResponse.json({
            success: true,
            message: 'Product added to store',
            product: newProduct
        });

    } catch (error) {
        console.error('Failed to add product:', error);
        return NextResponse.json({ success: false, error: 'Failed to update catalog' }, { status: 500 });
    }
}
