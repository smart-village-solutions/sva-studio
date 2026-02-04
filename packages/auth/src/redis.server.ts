import Redis from 'ioredis';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let redisClient: Redis | null = null;

/**
 * Build Redis client options with optional TLS and ACL support.
 */
const buildRedisOptions = (tlsEnabled: boolean = false) => {
  const options: Redis.RedisOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true,
  };

  // Add TLS configuration if enabled
  if (tlsEnabled) {
    try {
      // Path resolution from workspace root
      const workspaceRoot = resolve(__dirname, '../../../');
      const caPath = process.env.REDIS_CA_PATH || resolve(workspaceRoot, 'dev/redis-tls/ca.pem');
      const certPath = process.env.REDIS_CERT_PATH || resolve(workspaceRoot, 'dev/redis-tls/redis.pem');
      const keyPath = process.env.REDIS_KEY_PATH || resolve(workspaceRoot, 'dev/redis-tls/redis-key.pem');

      const caCert = readFileSync(caPath, 'utf8');
      const cert = readFileSync(certPath, 'utf8');
      const key = readFileSync(keyPath, 'utf8');

      options.tls = {
        ca: [caCert],
        cert: cert,
        key: key,
        // For self-signed certificates in development
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      };

      console.log('[REDIS] TLS enabled with certificates');
    } catch (err) {
      console.warn('[REDIS] TLS enabled but certificates not found, proceeding without:', err);
    }
  }

  // Add ACL authentication if credentials provided
  if (process.env.REDIS_USERNAME) {
    options.username = process.env.REDIS_USERNAME;
    options.password = process.env.REDIS_PASSWORD || '';
    console.log(`[REDIS] ACL enabled with user: ${process.env.REDIS_USERNAME}`);
  }

  return options;
};

/**
 * Get or create the Redis client instance (singleton pattern).
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const tlsEnabled = process.env.TLS_ENABLED === 'true' || redisUrl.startsWith('rediss://');
    const options = buildRedisOptions(tlsEnabled);

    redisClient = new Redis(redisUrl, options);

    redisClient.on('error', (err) => {
      console.error('[REDIS] Connection error:', err);
    });

    redisClient.on('connect', () => {
      const mode = tlsEnabled ? '(TLS)' : '(unencrypted)';
      console.log(`[REDIS] Connected to Redis ${mode}`);
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
