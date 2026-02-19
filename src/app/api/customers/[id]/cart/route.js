import { NextResponse } from 'next/server';
import { getCart, upsertCartItem, removeFromCart, clearCart, getCustomerById } from '@/lib/db';
import { writeCustomerCache, readCacheEntry } from '@/lib/cacheSync';
import { emitCacheSyncJob } from '@/workers/cacheSyncWorker';

/**
 * GET - Fetch persistent cart for a customer
 */
export async function GET(request, { params }) {
    const { id: customerId } = params;

    try {
        // 1. Try Cache-First
        const cached = readCacheEntry('customer', `${customerId}/cart`);
        if (cached) {
            console.log(`[Cart] 🗃 Serving cart for ${customerId} from cache`);
            // Background refresh
            setImmediate(() => _refreshCartCache(customerId).catch(console.error));
            return NextResponse.json(cached);
        }

        // 2. Cache miss - Fetch from DB
        const cart = await _refreshCartCache(customerId);
        return NextResponse.json(cart);

    } catch (error) {
        console.error(`GET /api/customers/${customerId}/cart error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST - Update cart (add/update item, or clear)
 * Body: { action: 'UPSERT'|'REMOVE'|'CLEAR', productId?, quantity? }
 */
export async function POST(request, { params }) {
    const { id: customerId } = params;
    const body = await request.json();
    const { action, productId, quantity } = body;

    try {
        let result;
        if (action === 'UPSERT') {
            result = await upsertCartItem(customerId, productId, quantity);
        } else if (action === 'REMOVE') {
            result = await removeFromCart(customerId, productId);
        } else if (action === 'CLEAR') {
            result = await clearCart(customerId);
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Trigger cache sync for the entire customer (to refresh cart.json)
        const customer = await getCustomerById(customerId);
        if (customer) {
            // Fetch fresh cart items to include in cache
            const cartItems = await getCart(customerId);
            customer.cart = cartItems;
            emitCacheSyncJob('customer', customerId, customer).catch(console.error);
        }

        return NextResponse.json({ success: true, result });

    } catch (error) {
        console.error(`POST /api/customers/${customerId}/cart error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function _refreshCartCache(customerId) {
    const cartItems = await getCart(customerId);
    const customer = await getCustomerById(customerId);
    if (customer) {
        customer.cart = cartItems;
        // This will update profile, wallet, inventory, AND cart.json
        // We use writeCustomerCache directly or via worker
        import('@/lib/cacheSync').then(m => m.writeCustomerCache(customerId, customer));
    }
    return { items: cartItems, _cachedAt: new Date().toISOString() };
}
