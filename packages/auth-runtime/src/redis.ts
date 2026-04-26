import { metrics } from '@opentelemetry/api';
import { createSdkLogger } from '@sva/server-runtime';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConnectionOptions as TlsConnectionOptions } from 'node:tls';

import { getRedisPassword, getRedisUrl } from './runtime-secrets.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });
const meter = metrics.getMeter('sva.auth.redis');

let redisClient: Redis | null = null;
let connectionErrorCount = 0;
const MAX_CONNECTION_ERRORS = 10;
let lastRedisError: string | null = null;
let redisConnectionStatus = 0;

const redisConnectionStatusGauge = meter.createObservableGauge('redis_connection_status', {
  description: 'Redis connection status for the auth session store (1=up, 0=down).',
});

redisConnectionStatusGauge.addCallback((result) => {
  result.observe(redisConnectionStatus);
});

export type RedisHealthSnapshot = {
  available: boolean;
  status: 'up' | 'down';
  errorCount: number;
  lastError: string | null;
};

const buildRedisOptions = (): RedisOptions => {
  const options: RedisOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > MAX_CONNECTION_ERRORS) {
        logger.error('Redis max retries exceeded', {
          operation: 'redis_retry',
          retry_attempt: times,
          max_retries: MAX_CONNECTION_ERRORS,
          action: 'stop_retrying',
        });
        return null;
      }

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

  const redisPassword = getRedisPassword();
  if (process.env.REDIS_USERNAME) {
    options.username = process.env.REDIS_USERNAME;
    options.password = redisPassword || '';
    logger.info('Redis ACL enabled', {
      operation: 'redis_init',
      acl_enabled: true,
      username: process.env.REDIS_USERNAME,
      has_password: !!redisPassword,
    });
  } else if (redisPassword) {
    options.password = redisPassword;
  }

  return options;
};

const buildTlsOptions = (tlsEnabled: boolean): TlsConnectionOptions | null => {
  if (!tlsEnabled) {
    return null;
  }

  try {
    const workspaceRoot = process.cwd();
    const caPath = process.env.REDIS_CA_PATH || resolve(workspaceRoot, 'dev/redis-tls/ca.pem');
    const certPath = process.env.REDIS_CERT_PATH || resolve(workspaceRoot, 'dev/redis-tls/redis.pem');
    const keyPath = process.env.REDIS_KEY_PATH || resolve(workspaceRoot, 'dev/redis-tls/redis-key.pem');

    const caCert = readFileSync(caPath, 'utf8');
    const cert = readFileSync(certPath, 'utf8');
    const key = readFileSync(keyPath, 'utf8');

    const tlsOptions = {
      ca: [caCert],
      cert,
      key,
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    };

    logger.info('Redis TLS configured successfully', {
      operation: 'redis_tls_init',
      tls_enabled: true,
      reject_unauthorized: process.env.NODE_ENV === 'production',
    });
    return tlsOptions;
  } catch (err) {
    logger.warn('Redis TLS configuration failed, continuing without TLS', {
      operation: 'redis_tls_init',
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
};

export const getRedisClient = (): Redis => {
  if (redisClient?.status === 'end') {
    redisClient = null;
  }

  if (!redisClient) {
    const redisUrl = getRedisUrl();
    const tlsEnabled = process.env.TLS_ENABLED === 'true' || redisUrl.startsWith('rediss://');
    const options = buildRedisOptions();
    const tlsOptions = buildTlsOptions(tlsEnabled);
    if (tlsOptions) {
      options.tls = tlsOptions;
    }

    redisClient = new Redis(redisUrl, options);

    redisClient.on('error', (err) => {
      connectionErrorCount += 1;

      const errorMessage = err instanceof Error ? err.message : String(err);
      lastRedisError = errorMessage;
      redisConnectionStatus = 0;
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

      if (connectionErrorCount >= MAX_CONNECTION_ERRORS) {
        logger.warn('Redis max errors reached, disconnecting client', {
          operation: 'redis_disconnect_after_errors',
          error_count: connectionErrorCount,
          action: 'disconnect',
        });
        redisClient?.disconnect();
      }
    });

    redisClient.on('connect', () => {
      connectionErrorCount = 0;
      lastRedisError = null;
      redisConnectionStatus = 1;

      logger.info('Redis connected', {
        operation: 'redis_connect',
        tls_enabled: tlsEnabled,
      });
    });

    redisClient.connect().catch((err) => {
      lastRedisError = err instanceof Error ? err.message : String(err);
      redisConnectionStatus = 0;
      logger.error('Redis connection failed', {
        operation: 'redis_connect',
        error: err instanceof Error ? err.message : String(err),
        error_type: err instanceof Error ? err.constructor.name : typeof err,
      });
    });
  }

  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    lastRedisError = null;
    redisConnectionStatus = 0;
    logger.info('Redis connection closed', {
      operation: 'redis_disconnect',
    });
  }
};

export const isRedisAvailable = async (): Promise<boolean> => {
  try {
    const client = getRedisClient();
    await client.ping();
    lastRedisError = null;
    redisConnectionStatus = 1;
    return true;
  } catch (error) {
    lastRedisError = error instanceof Error ? error.message : String(error);
    redisConnectionStatus = 0;
    logger.warn('Redis unavailable', {
      operation: 'redis_health_check',
      available: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

export const getLastRedisError = (): string | null => lastRedisError;

export const getRedisHealthSnapshot = (): RedisHealthSnapshot => ({
  available: redisConnectionStatus === 1,
  status: redisConnectionStatus === 1 ? 'up' : 'down',
  errorCount: connectionErrorCount,
  lastError: lastRedisError,
});
