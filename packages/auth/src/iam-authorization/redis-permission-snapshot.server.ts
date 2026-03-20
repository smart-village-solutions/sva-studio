import type { EffectivePermission } from '@sva/core';
import { createHash, createHmac } from 'node:crypto';
import { createSdkLogger } from '@sva/sdk/server';

import { getRedisClient } from '../redis.server.js';

const logger = createSdkLogger({ component: 'iam-permission-cache', level: 'info' });

const SNAPSHOT_TTL_SECONDS = 900;
const SNAPSHOT_KEY_PREFIX = 'perm:v1';
const SNAPSHOT_SCHEMA_VERSION = 1;

export type PermSnapshotKey = {
  instanceId: string;
  userId: string;
  organizationId?: string;
  geoCtxHash?: string;
};

type StoredSnapshot = {
  readonly permissions: readonly EffectivePermission[];
  readonly version: string;
  readonly schema_version: number;
  readonly signed_at: string;
  readonly hmac: string;
  readonly createdAt?: string;
};

export type RedisSnapshotResult =
  | { hit: true; permissions: readonly EffectivePermission[]; version: string }
  | { hit: false; reason: 'miss' | 'integrity_error' | 'redis_unavailable' };

export type RedisSnapshotWriteResult =
  | { ok: true; version: string }
  | { ok: false; reason: 'redis_unavailable' };

const computeCtxHash = (value: string | undefined): string => {
  if (!value) return 'none';
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
};

const buildRedisKey = (key: PermSnapshotKey): string => {
  const orgHash = computeCtxHash(key.organizationId);
  const geoHash = key.geoCtxHash ?? 'none';
  return `${SNAPSHOT_KEY_PREFIX}:${key.instanceId}:${key.userId}:${orgHash}:${geoHash}`;
};

const computeHmac = (data: string): string => {
  const secret = process.env.REDIS_SNAPSHOT_HMAC_SECRET ?? 'dev-hmac-secret-change-in-prod';
  return createHmac('sha256', secret).update(data).digest('hex');
};

const serializeSignedPayload = (stored: Pick<StoredSnapshot, 'permissions' | 'version' | 'schema_version' | 'signed_at'>) =>
  JSON.stringify(stored);

export const getRedisPermissionSnapshot = async (key: PermSnapshotKey): Promise<RedisSnapshotResult> => {
  try {
    const redis = getRedisClient();
    const redisKey = buildRedisKey(key);
    const raw = await redis.get(redisKey);

    if (!raw) {
      return { hit: false, reason: 'miss' };
    }

    const stored: StoredSnapshot = JSON.parse(raw);
    const signedAt = stored.signed_at ?? stored.createdAt;
    if (!signedAt || typeof stored.schema_version !== 'number') {
      logger.warn('Redis permission snapshot metadata missing — evicting key', {
        operation: 'snapshot_get',
        key: redisKey,
        integrity_check: 'failed',
        integrity_check_failed: true,
      });
      await redis.del(redisKey);
      return { hit: false, reason: 'integrity_error' };
    }

    const expectedHmac = computeHmac(
      serializeSignedPayload({
        permissions: stored.permissions,
        version: stored.version,
        schema_version: stored.schema_version,
        signed_at: signedAt,
      })
    );

    if (stored.hmac !== expectedHmac) {
      logger.warn('Redis permission snapshot HMAC mismatch — evicting key', {
        operation: 'snapshot_get',
        key: redisKey,
        integrity_check: 'failed',
        integrity_check_failed: true,
      });
      await redis.del(redisKey);
      return { hit: false, reason: 'integrity_error' };
    }

    return { hit: true, permissions: stored.permissions, version: stored.version };
  } catch (error) {
    logger.error('Redis permission snapshot get failed', {
      operation: 'snapshot_get',
      error: error instanceof Error ? error.message : String(error),
    });
    return { hit: false, reason: 'redis_unavailable' };
  }
};

export const setRedisPermissionSnapshot = async (
  key: PermSnapshotKey,
  permissions: readonly EffectivePermission[]
): Promise<RedisSnapshotWriteResult> => {
  try {
    const redis = getRedisClient();
    const redisKey = buildRedisKey(key);
    const version = createHash('sha256').update(JSON.stringify(permissions)).digest('hex').slice(0, 16);
    const signedAt = new Date().toISOString();

    const hmac = computeHmac(
      serializeSignedPayload({
        permissions,
        version,
        schema_version: SNAPSHOT_SCHEMA_VERSION,
        signed_at: signedAt,
      })
    );

    const stored: StoredSnapshot = {
      permissions,
      version,
      schema_version: SNAPSHOT_SCHEMA_VERSION,
      signed_at: signedAt,
      hmac,
    };
    await redis.setex(redisKey, SNAPSHOT_TTL_SECONDS, JSON.stringify(stored));

    logger.debug('Redis permission snapshot stored', {
      operation: 'snapshot_set',
      key: redisKey,
      ttl_s: SNAPSHOT_TTL_SECONDS,
      version,
      schema_version: SNAPSHOT_SCHEMA_VERSION,
    });
    return { ok: true, version };
  } catch (error) {
    logger.error('Redis permission snapshot set failed', {
      operation: 'snapshot_set',
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: 'redis_unavailable' };
  }
};

export const invalidateRedisPermissionSnapshots = async (
  instanceId: string,
  userId?: string
): Promise<number> => {
  try {
    const redis = getRedisClient();
    const pattern = userId
      ? `${SNAPSHOT_KEY_PREFIX}:${instanceId}:${userId}:*`
      : `${SNAPSHOT_KEY_PREFIX}:${instanceId}:*`;

    let deleted = 0;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== '0');

    logger.info('Redis permission snapshots invalidated', {
      operation: 'snapshot_invalidate',
      instance_id: instanceId,
      user_id: userId ?? 'all',
      deleted_count: deleted,
    });

    return deleted;
  } catch (error) {
    logger.error('Redis permission snapshot invalidation failed', {
      operation: 'snapshot_invalidate',
      instance_id: instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
};
