import { NextResponse } from 'next/server';
import { getChatHistory } from '@/lib/db';
import { readCacheEntry, writeCacheEntry } from '@/lib/cacheSync';

/**
 * GET - Fetch chat history for a customer
 */
export async function GET(request, { params }) {
    const { id: customerId } = params;

    try {
        // 1. Try Cache-First (Optional: based on your sync strategy)
        // For now we fetch from DB as it's more reliable for real-time chats
        // but we can cache the result for 1 minute
        const cacheId = `chat_history_${customerId}`;
        const cached = readCacheEntry('customer', `${customerId}/chat_history`);

        if (cached) {
            console.log(`[Chat] 🗃 Serving chat history for ${customerId} from cache`);
            // Background refresh
            setImmediate(() => _refreshChatHistory(customerId).catch(console.error));
            return NextResponse.json(cached);
        }

        // 2. Cache Miss - Fetch from DB
        const result = await _refreshChatHistory(customerId);
        return NextResponse.json(result);

    } catch (error) {
        console.error(`GET /api/customers/${customerId}/chat error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function _refreshChatHistory(customerId) {
    const history = await getChatHistory(customerId);
    const payload = {
        success: true,
        _cachedAt: new Date().toISOString(),
        data: history
    };

    // Cache the history list in customer/{id}/chat_history.json
    writeCacheEntry('customer', `${customerId}/chat_history`, payload);
    return payload;
}
