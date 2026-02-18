export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { syncMarketingData } = await import('./services/marketingService');

        console.log('Starting Marketing Data Sync Scheduler...');

        // Initial sync on startup (optional, maybe skip to avoid slow startup)
        // await syncMarketingData(1); 

        // Schedule hourly sync (3600000 ms)
        setInterval(async () => {
            console.log(`[${new Date().toISOString()}] Running background marketing sync...`);
            try {
                const result = await syncMarketingData(1); // Sync last 1 month primarily for updates
                console.log(`[${new Date().toISOString()}] Background sync complete:`, result.message);
            } catch (err) {
                console.error(`[${new Date().toISOString()}] Background sync failed:`, err);
            }
        }, 3600000);
    }
}
