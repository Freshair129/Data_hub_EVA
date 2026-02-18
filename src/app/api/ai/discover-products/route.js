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
        const convFile = path.join(DATA_DIR, customerId, `conv_${customerId}.json`);

        if (!fs.existsSync(convFile)) {
            return NextResponse.json({ success: false, error: 'Conversation history not found' }, { status: 404 });
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
        const catalogPath = path.join(process.cwd(), 'public/data/catalog.json');
        const catalog = readJsonFile(catalogPath);
        const allCatalogItems = [
            ...(catalog?.packages || []),
            ...(catalog?.products || [])
        ];

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

        const catalogPath = path.join(process.cwd(), 'public/data/catalog.json');
        const catalog = readJsonFile(catalogPath);

        if (!catalog) {
            return NextResponse.json({ success: false, error: 'Catalog not found' }, { status: 500 });
        }

        // Create new ID
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

        // Add to products array
        catalog.products = catalog.products || [];
        catalog.products.push(newProduct);

        fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 4));

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
