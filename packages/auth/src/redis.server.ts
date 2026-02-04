import Redis from 'ioredis';

let redisClient: Redis | null = null;

/**
 * Get or create the Redis client instance (singleton pattern).
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      console.error('[REDIS] Connection error:', err);
    });

    redisClient.on('connect', () => {
      console.log('[REDIS] Connected to Redis');
    });

    // Connect immediately
    redisClient.connect().catch((err) => {
      console.error('[REDIS] Failed to connect:', err);
    });
  }

  return redisClient;
};

/**
 * Close the Redis connection (for graceful shutdown).
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[REDIS] Connection closed');
  }
};

/**
 * Check if Redis is available (fallback to in-memory if not).
 */
export const isRedisAvailable = async (): Promise<boolean> => {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    console.warn('[REDIS] Not available, using in-memory fallback:', error);
    return false;
  }
};
