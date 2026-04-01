import type { EffectivePermission } from '@sva/core';

import type { PermSnapshotKey } from './redis-permission-snapshot.server.js';
import {
  getRedisPermissionSnapshot,
  setRedisPermissionSnapshot,
} from './redis-permission-snapshot.server.js';
import { loadPermissionsFromDb, type PermissionLookupInput } from './permission-store.queries.js';
import type { EffectivePermissionsResolution } from './shared.js';
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

export type PermissionResolutionDeps = Readonly<{
  ensureInvalidationListener: () => Promise<void>;
  cache: Pick<typeof permissionSnapshotCache, 'get' | 'set' | 'size'>;
  getRedisPermissionSnapshot: typeof getRedisPermissionSnapshot;
  setRedisPermissionSnapshot: typeof setRedisPermissionSnapshot;
  loadPermissionsFromDb: (input: PermissionLookupInput) => Promise<readonly EffectivePermission[]>;
  recordPermissionCacheColdStart: typeof recordPermissionCacheColdStart;
  recordPermissionCacheRedisLatency: typeof recordPermissionCacheRedisLatency;
  recordPermissionCacheRecompute: typeof recordPermissionCacheRecompute;
  iamCacheLookupCounter: typeof iamCacheLookupCounter;
  cacheLogger: typeof cacheLogger;
  logger: typeof logger;
  cacheMetricsState: typeof cacheMetricsState;
}>;

const toRedisSnapshotKey = (input: PermissionLookupInput): PermSnapshotKey => ({
  instanceId: input.instanceId,
  userId: input.keycloakSubject,
  organizationId: input.organizationId,
});

const defaultPermissionResolutionDeps: PermissionResolutionDeps = {
  ensureInvalidationListener,
  cache: permissionSnapshotCache,
  getRedisPermissionSnapshot,
  setRedisPermissionSnapshot,
  loadPermissionsFromDb,
  recordPermissionCacheColdStart,
  recordPermissionCacheRedisLatency,
  recordPermissionCacheRecompute,
  iamCacheLookupCounter,
  cacheLogger,
  logger,
  cacheMetricsState,
};

export const resolveEffectivePermissionsWithDeps = async (
  input: PermissionLookupInput,
  deps: PermissionResolutionDeps
): Promise<EffectivePermissionsResolution> => {
  await deps.ensureInvalidationListener();

  const lookup = deps.cache.get(input);

  if (lookup.status === 'hit' && lookup.snapshot) {
    deps.cacheMetricsState.lookups += 1;
    deps.iamCacheLookupCounter.add(1, { hit: true });
    deps.cacheLogger.debug('Permission snapshot cache lookup', {
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
    deps.cacheMetricsState.staleLookups += 1;
    deps.cacheLogger.warn('Stale permission snapshot detected', {
      operation: 'cache_stale_detected',
      age_s: lookup.ageSeconds,
      max_ttl_s: 300,
      ...buildRequestContext(input.instanceId),
    });
  }

  if (deps.cache.size() === 0) {
    deps.recordPermissionCacheColdStart(input.instanceId);
  }

  const redisKey = toRedisSnapshotKey(input);
  const redisLookupStartedAt = performance.now();
  const redisLookup = await deps.getRedisPermissionSnapshot(redisKey);
  deps.recordPermissionCacheRedisLatency(
    performance.now() - redisLookupStartedAt,
    redisLookup.hit || redisLookup.reason !== 'redis_unavailable'
  );

  if (redisLookup.hit) {
    deps.cacheMetricsState.lookups += 1;
    const snapshot = deps.cache.set(input, redisLookup.permissions, Date.now(), redisLookup.version);
    deps.iamCacheLookupCounter.add(1, { hit: true });
    deps.cacheLogger.debug('Permission snapshot cache lookup', {
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
    deps.cacheMetricsState.lookups += 1;
    deps.iamCacheLookupCounter.add(1, { hit: false });
    deps.logger.error('Redis permission snapshot lookup failed', {
      operation: 'cache_lookup_failed',
      error: redisLookup.reason,
      ...buildRequestContext(input.instanceId),
    });
    return { ok: false, error: 'database_unavailable' };
  }

  deps.cacheMetricsState.lookups += 1;
  deps.iamCacheLookupCounter.add(1, { hit: false });
  deps.cacheLogger.debug('Permission snapshot cache lookup', {
    operation: 'cache_lookup',
    hit: false,
    cache_layer: 'redis',
    miss_reason: redisLookup.reason,
    ...buildRequestContext(input.instanceId),
  });

  try {
    const permissions = await deps.loadPermissionsFromDb(input);
    const redisWrite = await deps.setRedisPermissionSnapshot(redisKey, permissions);
    if (!redisWrite.ok) {
      deps.logger.error('Redis permission snapshot write failed after recompute', {
        operation: 'cache_store_failed',
        error: redisWrite.reason,
        ...buildRequestContext(input.instanceId),
      });
      return { ok: false, error: 'database_unavailable' };
    }
    deps.recordPermissionCacheRecompute();
    const snapshot = deps.cache.set(input, permissions, Date.now(), redisWrite.version);

    if (lookup.status === 'stale') {
      deps.cacheLogger.info('Permission snapshot recomputed after stale detection', {
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
    deps.logger.error('Failed to recompute permission snapshot', {
      operation: 'cache_invalidate_failed',
      error: error instanceof Error ? error.message : String(error),
      ...buildRequestContext(input.instanceId),
    });

    return { ok: false, error: 'database_unavailable' };
  }
};

export const resolveEffectivePermissions = async (input: PermissionLookupInput): Promise<EffectivePermissionsResolution> =>
  resolveEffectivePermissionsWithDeps(input, defaultPermissionResolutionDeps);
