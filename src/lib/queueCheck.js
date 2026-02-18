
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export async function checkRedisConnection() {
    const redis = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000
    });

    try {
        await redis.ping();
        await redis.quit();
        return true;
    } catch (error) {
        console.warn(`Redis Connection Warning: ${error.message} (Using local fallback is not recommended for production)`);
        await redis.quit();
        return false;
    }
}
