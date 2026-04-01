import { createHash } from 'node:crypto';

import type { PermSnapshotKey } from './redis-permission-snapshot.server.js';
import {
  getRedisPermissionSnapshot,
  setRedisPermissionSnapshot,
} from './redis-permission-snapshot.server.js';
import type { EffectivePermissionsResolution } from './shared.js';
import { type PermissionLookupInput, loadPermissionsFromDb } from './permission-store.queries.js';
import {
  buildRequestContext,
  cacheLogger,
  cacheMetricsState,
  ensureInvalidationListener,
  iamCacheLookupCounter,
  logger,
  permissionSnapshotCache,
  recordPermissionCacheColdStart,
  recordPermissionCacheRecompute,
  recordPermissionCacheRedisLatency,
} from './shared.js';

const normalizeGeoContext = (input: PermissionLookupInput) => {
  const geoUnitId = input.geoUnitId?.trim() || undefined;
  const geoHierarchy = input.geoHierarchy
    ?.map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (!geoUnitId && (!geoHierarchy || geoHierarchy.length === 0)) {
    return undefined;
  }

  return {
    ...(geoUnitId ? { geoUnitId } : {}),
    ...(geoHierarchy && geoHierarchy.length > 0 ? { geoHierarchy: [...new Set(geoHierarchy)] } : {}),
  };
};

const toGeoContextHash = (input: PermissionLookupInput): string | undefined => {
  const normalized = normalizeGeoContext(input);
  if (!normalized) {
    return undefined;
  }

  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
};

const toSnapshotLookupKey = (input: PermissionLookupInput) => ({
  instanceId: input.instanceId,
  keycloakSubject: input.keycloakSubject,
  organizationId: input.organizationId,
  geoContextHash: toGeoContextHash(input),
});

const toRedisSnapshotKey = (
  snapshotKey: ReturnType<typeof toSnapshotLookupKey>
): PermSnapshotKey => ({
  instanceId: snapshotKey.instanceId,
  userId: snapshotKey.keycloakSubject,
  organizationId: snapshotKey.organizationId,
  geoCtxHash: snapshotKey.geoContextHash,
});

export const resolveEffectivePermissions = async (input: PermissionLookupInput): Promise<EffectivePermissionsResolution> => {
  await ensureInvalidationListener();

  const snapshotLookupKey = toSnapshotLookupKey(input);
  const lookup = permissionSnapshotCache.get(snapshotLookupKey);

  if (lookup.status === 'hit' && lookup.snapshot) {
    cacheMetricsState.lookups += 1;
    iamCacheLookupCounter.add(1, { hit: true });
    cacheLogger.debug('Permission snapshot cache lookup', {
      operation: 'cache_lookup',
      hit: true,
      cache_layer: 'memory',
      ttl_remaining_s: lookup.ttlRemainingSeconds,
      ...buildRequestContext(input.instanceId),
    });
    return {
      ok: true,
      permissions: lookup.snapshot!.permissions,
      cacheStatus: 'hit',
      snapshotVersion: lookup.snapshot?.snapshotVersion,
    };
  }

  if (lookup.status === 'stale') {
    cacheMetricsState.staleLookups += 1;
    cacheLogger.warn('Stale permission snapshot detected', {
      operation: 'cache_stale_detected',
      age_s: lookup.ageSeconds,
      max_ttl_s: 300,
      ...buildRequestContext(input.instanceId),
    });
  }

  if (permissionSnapshotCache.size() === 0) {
    recordPermissionCacheColdStart(input.instanceId);
  }

  const redisKey = toRedisSnapshotKey(snapshotLookupKey);
  const redisLookupStartedAt = performance.now();
  const redisLookup = await getRedisPermissionSnapshot(redisKey);
  recordPermissionCacheRedisLatency(
    performance.now() - redisLookupStartedAt,
    redisLookup.hit || redisLookup.reason !== 'redis_unavailable'
  );

  if (redisLookup.hit) {
    cacheMetricsState.lookups += 1;
    const snapshot = permissionSnapshotCache.set(
      snapshotLookupKey,
      redisLookup.permissions,
      Date.now(),
      redisLookup.version
    );
    iamCacheLookupCounter.add(1, { hit: true });
    cacheLogger.debug('Permission snapshot cache lookup', {
      operation: 'cache_lookup',
      hit: true,
      cache_layer: 'redis',
      ...buildRequestContext(input.instanceId),
    });
    return {
      ok: true,
      permissions: redisLookup.permissions,
      cacheStatus: 'hit',
      snapshotVersion: snapshot.snapshotVersion,
    };
  }

  if (redisLookup.reason === 'redis_unavailable') {
    cacheMetricsState.lookups += 1;
    iamCacheLookupCounter.add(1, { hit: false });
    logger.error('Redis permission snapshot lookup failed', {
      operation: 'cache_lookup_failed',
      error: redisLookup.reason,
      ...buildRequestContext(input.instanceId),
    });
    return { ok: false, error: 'database_unavailable' };
  }

  cacheMetricsState.lookups += 1;
  iamCacheLookupCounter.add(1, { hit: false });
  cacheLogger.debug('Permission snapshot cache lookup', {
    operation: 'cache_lookup',
    hit: false,
    cache_layer: 'redis',
    miss_reason: redisLookup.reason,
    ...buildRequestContext(input.instanceId),
  });

  try {
    const permissions = await loadPermissionsFromDb(input);
    const redisWrite = await setRedisPermissionSnapshot(redisKey, permissions);
    if (!redisWrite.ok) {
      logger.error('Redis permission snapshot write failed after recompute', {
        operation: 'cache_store_failed',
        error: redisWrite.reason,
        ...buildRequestContext(input.instanceId),
      });
      return { ok: false, error: 'database_unavailable' };
    }
    recordPermissionCacheRecompute();
    const snapshot = permissionSnapshotCache.set(
      snapshotLookupKey,
      permissions,
      Date.now(),
      redisWrite.version
    );

    if (lookup.status === 'stale') {
      cacheLogger.info('Permission snapshot recomputed after stale detection', {
        operation: 'cache_invalidate',
        trigger: 'recompute',
        affected_keys: 1,
        ...buildRequestContext(input.instanceId),
      });
    }

    return {
      ok: true,
      permissions,
      cacheStatus: lookup.status === 'stale' ? 'recompute' : 'miss',
      snapshotVersion: snapshot.snapshotVersion,
    };
  } catch (error) {
    logger.error('Failed to recompute permission snapshot', {
      operation: 'cache_invalidate_failed',
      error: error instanceof Error ? error.message : String(error),
      ...buildRequestContext(input.instanceId),
    });

    return { ok: false, error: 'database_unavailable' };
  }
};
