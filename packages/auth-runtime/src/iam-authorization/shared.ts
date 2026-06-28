import type {
  AuthorizeRequest,
  AuthorizeReasonCode,
  EffectivePermission,
  IamApiErrorCode,
  IamApiErrorResponse,
  MePermissionsResponse,
  SnapshotCacheStatus,
} from '@sva/iam-core';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { metrics } from '@opentelemetry/api';
import type { PoolClient } from 'pg';

import { parseInvalidationEvent, PermissionSnapshotCache } from '../iam-authorization-cache.js';
import { processSnapshotInvalidationEvent } from './snapshot-invalidation.server.js';
import {
  createPoolResolver,
  jsonResponse,
  type QueryClient,
  withResolvedInstanceDb,
} from '../db.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import { isUuid, readString } from '../shared/input-readers.js';
import { buildLogContext } from '../log-context.js';
import { authorizeRequestSchema } from '../shared/schemas.js';
import {
  cacheMetricsState,
  buildPermissionCacheColdStartLog,
  markPermissionCacheColdStart,
} from './shared-cache-health.js';
export { readResourceType, toEffectivePermissions } from './shared-effective-permissions.js';
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
    }
  | { ok: false; error: 'database_unavailable' };

export type ResolvedGeoContext = {
  readonly geoUnitId?: string;
  readonly geoHierarchy?: readonly string[];
};

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
export const iamCacheStaleEntriesGauge = authMeter.createObservableGauge(
  'sva_iam_cache_stale_entry_rate',
  {
    description: 'Ratio of stale cache lookups in IAM authorization path.',
  }
);

export const resolvePool = createPoolResolver(getIamDatabaseUrl);
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

export const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withResolvedInstanceDb(resolvePool, instanceId, work);

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

export const loadAuthorizeRequest = async (request: Request): Promise<AuthorizeRequest | null> => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return null;
  }

  const parsed = authorizeRequestSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
};

export const errorResponse = (status: number, error: IamApiErrorCode) =>
  jsonResponse(status, { error } satisfies IamApiErrorResponse);

export const buildMePermissionsResponse = (input: {
  instanceId: string;
  organizationId?: string;
  permissions: readonly EffectivePermission[];
  actorUserId: string;
  effectiveUserId: string;
  isImpersonating: boolean;
  snapshotVersion?: string;
  cacheStatus?: SnapshotCacheStatus;
}): MePermissionsResponse => ({
  instanceId: input.instanceId,
  organizationId: input.organizationId,
  permissions: input.permissions,
  subject: {
    actorUserId: input.actorUserId,
    effectiveUserId: input.effectiveUserId,
    isImpersonating: input.isImpersonating,
  },
  evaluatedAt: new Date().toISOString(),
  requestId: getWorkspaceContext().requestId,
  traceId: getWorkspaceContext().traceId,
  snapshotVersion: input.snapshotVersion,
  cacheStatus: input.cacheStatus,
  provenance: {
    hasGroupDerivedPermissions: input.permissions.some(
      (permission) => (permission.sourceGroupIds?.length ?? 0) > 0
    ),
    hasGeoInheritance: input.permissions.some((permission) => {
      const scope = permission.scope;
      if (!scope) {
        return false;
      }
      return Array.isArray(scope.allowedGeoUnitIds) || Array.isArray(scope.restrictedGeoUnitIds);
    }),
  },
});

export type DeniedAuthorizeResponseInput = {
  reason: AuthorizeReasonCode;
  instanceId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  traceId?: string;
  diagnostics?: Record<string, string>;
};

export const resolveInstanceIdFromRequest = (request: Request, userInstanceId?: string) => {
  const url = new URL(request.url);
  return readString(url.searchParams.get('instanceId')) ?? userInstanceId;
};

export const resolveOrganizationIdFromRequest = (request: Request) => {
  const url = new URL(request.url);
  const organizationId = readString(url.searchParams.get('organizationId'));
  if (!organizationId) {
    return undefined;
  }
  return isUuid(organizationId) ? organizationId : null;
};

export const resolveActingAsUserIdFromRequest = (request: Request) => {
  const url = new URL(request.url);
  return readString(url.searchParams.get('actingAsUserId'));
};

const MAX_GEO_HIERARCHY_LENGTH = 32;

const normalizeGeoHierarchy = (
  entries: readonly string[]
): readonly string[] | undefined | null => {
  const normalized = entries
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));

  if (normalized.length === 0) {
    return undefined;
  }

  const deduplicated = [...new Set(normalized)];
  if (deduplicated.length > MAX_GEO_HIERARCHY_LENGTH) {
    return null;
  }

  return deduplicated;
};

export const resolveGeoContextFromRequest = (request: Request): ResolvedGeoContext | null => {
  const url = new URL(request.url);
  const geoUnitId = readString(url.searchParams.get('geoUnitId'));
  if (geoUnitId && !isUuid(geoUnitId)) {
    return null;
  }

  const geoHierarchy = normalizeGeoHierarchy(
    url.searchParams.getAll('geoHierarchy').flatMap((entry) => entry.split(','))
  );

  if (geoHierarchy === null) {
    return null;
  }

  if (geoHierarchy?.some((entry) => !isUuid(entry))) {
    return null;
  }

  if (!geoUnitId && !geoHierarchy) {
    return {};
  }

  return {
    ...(geoUnitId ? { geoUnitId } : {}),
    ...(geoHierarchy ? { geoHierarchy } : {}),
  };
};
