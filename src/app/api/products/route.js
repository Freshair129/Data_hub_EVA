import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/db';

export async function GET() {
    try {
        const allProducts = await getAllProducts();

        // Filter into courses and bundles (packages)
        // Note: db.js returns catalog packages/products
        const courses = allProducts.filter(p => !p.id.startsWith('TVS-PKG'));
        const packages = allProducts.filter(p => p.id.startsWith('TVS-PKG'));

        return NextResponse.json({ courses, packages });
    } catch (error) {
        console.error('GET /api/products error:', error);
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }
}
