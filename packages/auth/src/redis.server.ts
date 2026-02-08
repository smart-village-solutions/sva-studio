import Redis from 'ioredis';
import { createSdkLogger } from '@sva/sdk';

const logger = createSdkLogger({ component: 'auth-redis', level: 'info' });

let redisClient: Redis | null = null;
let connectionErrorCount = 0;
const MAX_CONNECTION_ERRORS = 10;

/**
 * Build Redis client options with optional TLS and ACL support.
 * NOTE: TLS is intentionally NOT configured here to avoid file I/O during module initialization.
 * Use configureTlsForClient() to add TLS after module loading.
 */
const buildRedisOptions = (tlsEnabled: boolean = false) => {
  const options: Redis.RedisOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      // Stop retrying after threshold
      if (times > MAX_CONNECTION_ERRORS) {
        logger.error('Redis max retries exceeded', {
          operation: 'redis_retry',
          retry_attempt: times,
          max_retries: MAX_CONNECTION_ERRORS,
          action: 'stop_retrying',
        });
        return null;
      }

      // Exponential backoff: 100ms → 200ms → 400ms → ... → max 3s
      const delay = Math.min(times * 100, 3000);

      logger.debug('Redis retry scheduled', {
        operation: 'redis_retry',
        retry_attempt: times,
        retry_delay_ms: delay,
        max_retries: MAX_CONNECTION_ERRORS,
      });

      return delay;
    },
    lazyConnect: true,
  };

  // Add ACL authentication if credentials provided
  if (process.env.REDIS_USERNAME) {
    options.username = process.env.REDIS_USERNAME;
    options.password = process.env.REDIS_PASSWORD || '';
    logger.info('Redis ACL enabled', {
      operation: 'redis_init',
      acl_enabled: true,
      username: process.env.REDIS_USERNAME,
      has_password: !!process.env.REDIS_PASSWORD,
    });
  }

  return options;
};

/**
 * Configure TLS for Redis client after module is loaded.
 * This is a safe deferred operation that doesn't block module initialization.
 */
export const configureTlsForClient = async (client: Redis, tlsEnabled: boolean) => {
  if (!tlsEnabled) {
    return;
  }

  try {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');

    const workspaceRoot = process.cwd();
    const caPath = process.env.REDIS_CA_PATH || resolve(workspaceRoot, 'dev/redis-tls/ca.pem');
    const certPath = process.env.REDIS_CERT_PATH || resolve(workspaceRoot, 'dev/redis-tls/redis.pem');
    const keyPath = process.env.REDIS_KEY_PATH || resolve(workspaceRoot, 'dev/redis-tls/redis-key.pem');

    const caCert = readFileSync(caPath, 'utf8');
    const cert = readFileSync(certPath, 'utf8');
    const key = readFileSync(keyPath, 'utf8');

    // Apply TLS to the client's options
    (client.options as any).tls = {
      ca: [caCert],
      cert: cert,
      key: key,
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    };

    logger.info('Redis TLS configured successfully', {
      operation: 'redis_tls_init',
      tls_enabled: true,
      reject_unauthorized: process.env.NODE_ENV === 'production',
    });
  } catch (err) {
    logger.warn('Redis TLS configuration failed, continuing without TLS', {
      operation: 'redis_tls_init',
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

/**
 * Get or create the Redis client instance (singleton pattern).
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const tlsEnabled = process.env.TLS_ENABLED === 'true' || redisUrl.startsWith('rediss://');
    const options = buildRedisOptions(tlsEnabled);

    // Create client without awaiting - keep module loading synchronous
    redisClient = new Redis(redisUrl, options);

    // Configure TLS asynchronously after the module is fully loaded
    // This won't block module initialization
    if (tlsEnabled) {
      configureTlsForClient(redisClient, tlsEnabled).catch((err) => {
        logger.error('Failed to configure TLS asynchronously', {
          operation: 'redis_tls_async_init',
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    redisClient.on('error', (err) => {
      connectionErrorCount++;

      const errorMessage = err instanceof Error ? err.message : String(err);
      const isAuthError = errorMessage.includes('WRONGPASS') || errorMessage.includes('NOAUTH');

      logger.error('Redis connection error', {
        operation: 'redis_connect',
        error: errorMessage,
        error_type: err instanceof Error ? err.constructor.name : typeof err,
        error_count: connectionErrorCount,
        max_errors: MAX_CONNECTION_ERRORS,
        is_auth_error: isAuthError,
        will_retry: connectionErrorCount < MAX_CONNECTION_ERRORS,
      });

      // Disconnect after max errors to prevent infinite loops
      if (connectionErrorCount >= MAX_CONNECTION_ERRORS) {
        logger.warn('Redis max errors reached, disconnecting client', {
          operation: 'redis_fallback',
          error_count: connectionErrorCount,
          fallback: 'in-memory',
          action: 'disconnect',
        });
        redisClient?.disconnect();
      }
    });

    redisClient.on('connect', () => {
      // Reset error count on successful connection
      connectionErrorCount = 0;

      logger.info('Redis connected', {
        operation: 'redis_connect',
        tls_enabled: tlsEnabled,
      });
    });

    // Connect immediately
    redisClient.connect().catch((err) => {
      logger.error('Redis connection failed', {
        operation: 'redis_connect',
        error: err instanceof Error ? err.message : String(err),
        error_type: err instanceof Error ? err.constructor.name : typeof err,
      });
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
    logger.info('Redis connection closed', {
      operation: 'redis_disconnect',
    });
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
    logger.warn('Redis unavailable, using in-memory fallback', {
      operation: 'redis_health_check',
      available: false,
      fallback: 'in-memory',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};
