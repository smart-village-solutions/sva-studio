import type { EffectivePermission, SnapshotCacheStatus } from '@sva/iam-core';
import { createSdkLogger } from '@sva/server-runtime';
import { metrics } from '@opentelemetry/api';
import type { PoolClient } from 'pg';

import { parseInvalidationEvent, PermissionSnapshotCache } from '../iam-authorization-cache.js';
import { processSnapshotInvalidationEvent } from './snapshot-invalidation.server.js';
import { resolvePool } from './shared-scope.js';
import { buildLogContext } from '../log-context.js';
import {
  cacheMetricsState,
  buildPermissionCacheColdStartLog,
  markPermissionCacheColdStart,
} from './shared-cache-health.js';
export { readResourceType, toEffectivePermissions } from './shared-effective-permissions.js';
export {
  resolvePool,
  withInstanceScopedDb,
  resolveInstanceIdFromRequest,
  resolveOrganizationIdFromRequest,
  resolveActingAsUserIdFromRequest,
  resolveGeoContextFromRequest,
} from './shared-scope.js';
export type { ResolvedGeoContext } from './shared-scope.js';
export {
  loadAuthorizeRequest,
  errorResponse,
  buildMePermissionsResponse,
} from './shared-response.js';
export type { DeniedAuthorizeResponseInput } from './shared-response.js';
export {
  cacheMetricsState,
  getPermissionCacheHealth,
  permissionCacheRuntimeState,
  recordPermissionCacheRecompute,
  recordPermissionCacheRedisLatency,
} from './shared-cache-health.js';

export type EffectivePermissionsResolution =
  | {
      ok: true;
      permissions: readonly EffectivePermission[];
      cacheStatus: SnapshotCacheStatus;
      snapshotVersion?: string;
      permissionRevision: Readonly<{
        instanceRevision: number;
        userRevision: number;
      }>;
    }
  | { ok: false; error: 'database_unavailable' };

export const logger: ReturnType<typeof createSdkLogger> = createSdkLogger({
  component: 'iam-authorize',
  level: 'info',
});
export const cacheLogger: ReturnType<typeof createSdkLogger> = createSdkLogger({
  component: 'iam-cache',
  level: 'info',
});
export const authMeter = metrics.getMeter('sva.auth');
export const iamAuthorizeLatencyHistogram = authMeter.createHistogram(
  'sva_iam_authorize_duration_ms',
  {
    description: 'Latency distribution for IAM authorize decisions in milliseconds.',
    unit: 'ms',
  }
);
export const iamCacheLookupCounter = authMeter.createCounter('sva_iam_cache_lookup_total', {
  description: 'Cache lookups for IAM authorization snapshots.',
});
export const iamCacheInvalidationLatencyHistogram = authMeter.createHistogram(
  'sva_iam_cache_invalidation_duration_ms',
  {
    description: 'End-to-end latency for IAM cache invalidation events.',
    unit: 'ms',
  }
);
export const iamPermissionRevisionReadLatencyHistogram = authMeter.createHistogram(
  'sva_iam_permission_revision_read_duration_ms',
  {
    description: 'Latency for PostgreSQL-authoritative IAM permission revision reads.',
    unit: 'ms',
  }
);
export const iamPermissionCacheLifecycleCounter = authMeter.createCounter(
  'sva_iam_permission_cache_lifecycle_total',
  {
    description: 'Lifecycle outcomes for revisions, recomputes, publishes and event eviction.',
  }
);
export const iamCacheStaleEntriesGauge = authMeter.createObservableGauge(
  'sva_iam_cache_stale_entry_rate',
  {
    description: 'Ratio of stale cache lookups in IAM authorization path.',
  }
);

export const permissionSnapshotCache = new PermissionSnapshotCache(300_000, 300_000);
export const CACHE_INVALIDATION_CHANNEL = 'iam_permission_snapshot_invalidation';

let invalidationListenerInit: Promise<void> | null = null;
let invalidationListenerClient: PoolClient | null = null;

iamCacheStaleEntriesGauge.addCallback((result) => {
  const staleRate =
    cacheMetricsState.lookups === 0
      ? 0
      : cacheMetricsState.staleLookups / cacheMetricsState.lookups;
  result.observe(staleRate);
});

export const buildRequestContext = (workspaceId?: string) =>
  buildLogContext(workspaceId, { includeTraceId: true });

export const recordPermissionCacheColdStart = (instanceId: string): void => {
  if (!markPermissionCacheColdStart()) {
    return;
  }

  const coldStartLog = buildPermissionCacheColdStartLog(instanceId);
  cacheLogger.info(coldStartLog.message, coldStartLog.attributes);
};

export const ensureInvalidationListener = async (): Promise<void> => {
  if (invalidationListenerInit) {
    return invalidationListenerInit;
  }

  invalidationListenerInit = (async () => {
    const pool = resolvePool();
    if (!pool) {
      return;
    }

    const client = (await pool.connect()) as PoolClient & {
      on?: (event: string, listener: (payload: { payload?: string }) => void) => void;
    };

    await client.query(`LISTEN ${CACHE_INVALIDATION_CHANNEL}`);
    invalidationListenerClient = client;

    cacheLogger.info('Cache invalidation listener initialized', {
      operation: 'cache_invalidate',
      trigger: 'pg_notify',
      listener_ready: Boolean(invalidationListenerClient),
      ...buildRequestContext(),
    });

    client.on?.('notification', (message) => {
      if (!message.payload) {
        return;
      }

      const receivedAt = Date.now();
      const parsed = parseInvalidationEvent(message.payload);
      if (!parsed) {
        cacheLogger.warn('Cache invalidation payload could not be parsed', {
          operation: 'cache_invalidate_failed',
          trigger: 'pg_notify',
          payload: message.payload,
          ...buildRequestContext(),
        });
        return;
      }

      permissionSnapshotCache.invalidate({
        instanceId: parsed.instanceId,
        keycloakSubject: parsed.keycloakSubject,
      });
      iamPermissionCacheLifecycleCounter.add(1, {
        operation: 'event_evict',
        scope: parsed.keycloakSubject ? 'user' : 'instance',
      });
      void processSnapshotInvalidationEvent(parsed.event).catch((error) => {
        cacheLogger.error('Redis snapshot invalidation failed', {
          operation: 'cache_invalidate_failed',
          trigger: parsed.trigger,
          error: error instanceof Error ? error.message : String(error),
          ...buildRequestContext(parsed.instanceId),
        });
      });
      iamCacheInvalidationLatencyHistogram.record(Date.now() - receivedAt, {
        trigger: parsed.trigger,
      });
      cacheLogger.info('Cache invalidation event received', {
        operation: 'cache_invalidate',
        trigger: parsed.trigger,
        affected_scope: parsed.keycloakSubject ? 'user' : 'instance',
        ...(parsed.revision
          ? {
              revision_scope: parsed.revision.scope,
              permission_revision: parsed.revision.value,
            }
          : {}),
        ...buildRequestContext(parsed.instanceId),
      });
    });
  })().catch((error) => {
    invalidationListenerInit = null;
    cacheLogger.error('Failed to initialize cache invalidation listener', {
      operation: 'cache_invalidate_failed',
      trigger: 'pg_notify',
      error: error instanceof Error ? error.message : String(error),
      ...buildRequestContext(),
    });
  });

  return invalidationListenerInit;
};
