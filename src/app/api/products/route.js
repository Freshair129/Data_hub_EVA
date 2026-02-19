import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/db';
import { readCacheEntry, writeCacheEntry } from '@/lib/cacheSync';

// Cache key for full product list snapshot
const CACHE_ENTITY = 'products';
const CACHE_ID = '__all__';

export async function GET() {
    try {
        // ── 1. Cache-First: return instantly if fresh ──
        const cached = readCacheEntry(CACHE_ENTITY, CACHE_ID);
        if (cached) {
            console.log('[Products] 🗃 Serving from local cache');

            // Background refresh
            setImmediate(() => _fetchAndCacheProducts().catch(console.error));

            return NextResponse.json({ ...cached, _source: 'cache' });
        }

        // ── 2. Cache Miss: fetch from DB, write cache ──
        console.log('[Products] Cache miss — fetching from DB...');
        return NextResponse.json(await _fetchAndCacheProducts());

    } catch (error) {
        console.error('GET /api/products error:', error);
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }
}

async function _fetchAndCacheProducts() {
    const allProducts = await getAllProducts();

    const courses = allProducts.filter(p => !p.id?.startsWith('TVS-PKG'));
    const packages = allProducts.filter(p => p.id?.startsWith('TVS-PKG'));

    const payload = { courses, packages };

    // Cache individual products too
    for (const p of allProducts) {
        if (p.id) {
            const subEntity = p.id.startsWith('TVS-PKG') ? 'products/packages' : 'products/courses';
            writeCacheEntry(subEntity, p.id, p);
        }
    }

    // Cache full list snapshot
    writeCacheEntry(CACHE_ENTITY, CACHE_ID, payload);

    return payload;
}
