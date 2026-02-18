import { NextResponse } from 'next/server';
import { syncMarketingData } from '@/services/marketingService';

/**
 * API Route to sync Facebook Ad insights to local storage
 * Supports deep sync via ?months query parameter
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const months = parseInt(searchParams.get('months') || '3'); // Default to 3 months

        const result = await syncMarketingData(months);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('Marketing Sync API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
