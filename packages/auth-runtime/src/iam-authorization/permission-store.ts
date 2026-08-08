import {
  getRedisPermissionSnapshot,
  setRedisPermissionSnapshot,
} from './redis-permission-snapshot.server.js';
import type { EffectivePermissionsResolution } from './shared.js';
import {
  type PermissionLookupInput,
  loadPermissionsWithClient,
} from './permission-store.queries.js';
import {
  type PermissionRevisionVector,
  revisionsEqual,
  toRedisSnapshotKey,
  toSnapshotLookupKey,
} from './permission-store.keys.js';
import {
  readPermissionRevisionVector,
  readPermissionRevisionVectorWithClient,
} from './permission-revision-store.js';
import { filterTenantEffectivePermissions } from './root-only-permissions.js';
import {
  buildRequestContext,
  cacheLogger,
  cacheMetricsState,
  ensureInvalidationListener,
  iamCacheLookupCounter,
  iamPermissionCacheLifecycleCounter,
  iamPermissionRevisionReadLatencyHistogram,
  logger,
  permissionSnapshotCache,
  recordPermissionCacheColdStart,
  recordPermissionCacheRecompute,
  recordPermissionCacheRedisLatency,
  withInstanceScopedDb,
} from './shared.js';

type RecomputeCandidate =
  | Readonly<{
      status: 'current';
      permissions: ReturnType<typeof filterTenantEffectivePermissions>;
    }>
  | Readonly<{ status: 'stale' }>;

const inFlightRecomputes = new Map<string, Promise<RecomputeCandidate>>();

const recomputePermissions = async (
  input: PermissionLookupInput,
  expectedRevision: PermissionRevisionVector
): Promise<RecomputeCandidate> => {
  const candidate = await withInstanceScopedDb(
    input.instanceId,
    async (client): Promise<RecomputeCandidate> => {
      const transactionRevision = await readPermissionRevisionVectorWithClient(
        client,
        input.instanceId,
        input.keycloakSubject
      );
      if (!revisionsEqual(transactionRevision, expectedRevision)) {
        return { status: 'stale' };
      }

      const permissions = filterTenantEffectivePermissions(
        await loadPermissionsWithClient(client, input)
      );
      return { status: 'current', permissions };
    },
    { isolationLevel: 'repeatable read' }
  );

  if (candidate.status === 'stale') {
    return candidate;
  }

  const revisionBeforePublish = await readPermissionRevisionVector(
    input.instanceId,
    input.keycloakSubject
  );
  return revisionsEqual(revisionBeforePublish, expectedRevision) ? candidate : { status: 'stale' };
};

const recomputePermissionsSingleFlight = (
  input: PermissionLookupInput,
  expectedRevision: PermissionRevisionVector,
  snapshotLookupKey: ReturnType<typeof toSnapshotLookupKey>
): Promise<RecomputeCandidate> => {
  const flightKey = JSON.stringify(snapshotLookupKey);
  const existing = inFlightRecomputes.get(flightKey);
  if (existing) {
    return existing;
  }

  const recompute = recomputePermissions(input, expectedRevision).finally(() => {
    if (inFlightRecomputes.get(flightKey) === recompute) {
      inFlightRecomputes.delete(flightKey);
    }
  });
  inFlightRecomputes.set(flightKey, recompute);
  return recompute;
};

const resolveEffectivePermissionsAttempt = async (
  input: PermissionLookupInput,
  attempt: number
): Promise<EffectivePermissionsResolution> => {
  await ensureInvalidationListener();

  let permissionRevision: PermissionRevisionVector;
  const revisionReadStartedAt = performance.now();
  try {
    permissionRevision = await readPermissionRevisionVector(
      input.instanceId,
      input.keycloakSubject
    );
    iamPermissionRevisionReadLatencyHistogram.record(performance.now() - revisionReadStartedAt, {
      outcome: 'success',
    });
    iamPermissionCacheLifecycleCounter.add(1, { operation: 'revision_read', outcome: 'success' });
  } catch (error) {
    iamPermissionRevisionReadLatencyHistogram.record(performance.now() - revisionReadStartedAt, {
      outcome: 'error',
    });
    iamPermissionCacheLifecycleCounter.add(1, { operation: 'revision_read', outcome: 'error' });
    logger.error('Permission revision read failed', {
      operation: 'revision_read_failed',
      error: error instanceof Error ? error.message : String(error),
      ...buildRequestContext(input.instanceId),
    });
    return { ok: false, error: 'database_unavailable' };
  }

  const snapshotLookupKey = toSnapshotLookupKey(input, permissionRevision);
  const lookup = permissionSnapshotCache.get(snapshotLookupKey);

  if (lookup.status === 'hit' && lookup.snapshot) {
    const permissions = filterTenantEffectivePermissions(lookup.snapshot.permissions);
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
      permissions,
      cacheStatus: 'hit',
      snapshotVersion: lookup.snapshot?.snapshotVersion,
      permissionRevision,
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
    const permissions = filterTenantEffectivePermissions(redisLookup.permissions);
    cacheMetricsState.lookups += 1;
    const snapshot = permissionSnapshotCache.set(
      snapshotLookupKey,
      permissions,
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
      permissions,
      cacheStatus: 'hit',
      snapshotVersion: snapshot.snapshotVersion,
      permissionRevision,
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
    const candidate = await recomputePermissionsSingleFlight(
      input,
      permissionRevision,
      snapshotLookupKey
    );
    if (candidate.status === 'stale') {
      iamPermissionCacheLifecycleCounter.add(1, {
        operation: 'stale_write_discarded',
        outcome: attempt < 1 ? 'retry' : 'failed',
      });
      cacheLogger.info('Stale permission recompute discarded', {
        operation: 'stale_write_discarded',
        attempt,
        ...buildRequestContext(input.instanceId),
      });
      return attempt < 1
        ? resolveEffectivePermissionsAttempt(input, attempt + 1)
        : { ok: false, error: 'database_unavailable' };
    }
    const permissions = candidate.permissions;
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
    iamPermissionCacheLifecycleCounter.add(1, { operation: 'recompute', outcome: 'success' });
    const snapshot = permissionSnapshotCache.set(
      snapshotLookupKey,
      permissions,
      Date.now(),
      redisWrite.version
    );
    iamPermissionCacheLifecycleCounter.add(1, { operation: 'publish', outcome: 'success' });

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
      permissionRevision,
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

export const resolveEffectivePermissions = (
  input: PermissionLookupInput
): Promise<EffectivePermissionsResolution> => resolveEffectivePermissionsAttempt(input, 0);
