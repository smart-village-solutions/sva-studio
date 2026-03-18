import type {
  AuthorizeRequest,
  AuthorizeReasonCode,
  EffectivePermission,
  IamApiErrorCode,
  IamApiErrorResponse,
  IamPermissionEffect,
  MePermissionsResponse,
} from '@sva/core';
import type { SnapshotCacheStatus } from '@sva/core';
import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';
import { metrics } from '@opentelemetry/api';
import type { PoolClient } from 'pg';

import { parseInvalidationEvent, PermissionSnapshotCache } from '../iam-authorization.cache';
import { processSnapshotInvalidationEvent } from './snapshot-invalidation.server';
import { createPoolResolver, jsonResponse, type QueryClient, withInstanceDb } from '../shared/db-helpers';
import { isUuid, readString } from '../shared/input-readers';
import { buildLogContext } from '../shared/log-context';
import { authorizeRequestSchema } from '../shared/schemas';

export type PermissionRow = {
  permission_key: string;
  action?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  effect?: IamPermissionEffect | null;
  scope?: Record<string, unknown> | null;
  role_id: string;
  organization_id: string | null;
  group_id?: string | null;
  group_key?: string | null;
  source_kind?: 'direct_role' | 'group_role' | null;
};

export type EffectivePermissionsResolution =
  | { ok: true; permissions: readonly EffectivePermission[]; cacheStatus: SnapshotCacheStatus }
  | { ok: false; error: 'database_unavailable' };

export const logger: ReturnType<typeof createSdkLogger> = createSdkLogger({ component: 'iam-authorize', level: 'info' });
export const cacheLogger: ReturnType<typeof createSdkLogger> = createSdkLogger({
  component: 'iam-cache',
  level: 'info',
});
export const authMeter = metrics.getMeter('sva.auth');
export const iamAuthorizeLatencyHistogram = authMeter.createHistogram('sva_iam_authorize_duration_ms', {
  description: 'Latency distribution for IAM authorize decisions in milliseconds.',
  unit: 'ms',
});
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
export const iamCacheStaleEntriesGauge = authMeter.createObservableGauge('sva_iam_cache_stale_entry_rate', {
  description: 'Ratio of stale cache lookups in IAM authorization path.',
});

export const resolvePool = createPoolResolver(() => process.env.IAM_DATABASE_URL);
export const permissionSnapshotCache = new PermissionSnapshotCache(300_000, 300_000);
export const CACHE_INVALIDATION_CHANNEL = 'iam_permission_snapshot_invalidation';
export const cacheMetricsState = { lookups: 0, staleLookups: 0 };
const CACHE_RECOMPUTE_WINDOW_MS = 60_000;
const CACHE_DEGRADED_LATENCY_MS = 50;
const CACHE_DEGRADED_RECOMPUTE_THRESHOLD = 20;
const CACHE_FAILED_REDIS_FAILURE_THRESHOLD = 3;

export const permissionCacheRuntimeState = {
  coldStartLogged: false,
  lastRedisLatencyMs: 0,
  consecutiveRedisFailures: 0,
  recomputeTimestampsMs: [] as number[],
};

let invalidationListenerInit: Promise<void> | null = null;
let invalidationListenerClient: PoolClient | null = null;

iamCacheStaleEntriesGauge.addCallback((result) => {
  const staleRate =
    cacheMetricsState.lookups === 0 ? 0 : cacheMetricsState.staleLookups / cacheMetricsState.lookups;
  result.observe(staleRate);
});

export const buildRequestContext = (workspaceId?: string) => buildLogContext(workspaceId, { includeTraceId: true });

const pruneRecomputeTimestamps = (nowMs: number): void => {
  permissionCacheRuntimeState.recomputeTimestampsMs =
    permissionCacheRuntimeState.recomputeTimestampsMs.filter(
      (timestamp) => nowMs - timestamp <= CACHE_RECOMPUTE_WINDOW_MS
    );
};

export const recordPermissionCacheColdStart = (instanceId: string): void => {
  if (permissionCacheRuntimeState.coldStartLogged) {
    return;
  }

  permissionCacheRuntimeState.coldStartLogged = true;
  cacheLogger.info('Permission cache cold start detected', {
    operation: 'cache_lookup',
    cache_cold_start: true,
    ...buildRequestContext(instanceId),
  });
};

export const recordPermissionCacheRedisLatency = (latencyMs: number, available: boolean): void => {
  permissionCacheRuntimeState.lastRedisLatencyMs = latencyMs;
  permissionCacheRuntimeState.consecutiveRedisFailures = available
    ? 0
    : permissionCacheRuntimeState.consecutiveRedisFailures + 1;
};

export const recordPermissionCacheRecompute = (nowMs = Date.now()): void => {
  pruneRecomputeTimestamps(nowMs);
  permissionCacheRuntimeState.recomputeTimestampsMs.push(nowMs);
};

export const getPermissionCacheHealth = (nowMs = Date.now()) => {
  pruneRecomputeTimestamps(nowMs);
  const recomputePerMinute = permissionCacheRuntimeState.recomputeTimestampsMs.length;
  const status =
    permissionCacheRuntimeState.consecutiveRedisFailures >= CACHE_FAILED_REDIS_FAILURE_THRESHOLD
      ? 'failed'
      : permissionCacheRuntimeState.lastRedisLatencyMs > CACHE_DEGRADED_LATENCY_MS ||
          recomputePerMinute > CACHE_DEGRADED_RECOMPUTE_THRESHOLD
        ? 'degraded'
        : 'ready';

  return {
    status,
    coldStart: !permissionCacheRuntimeState.coldStartLogged,
    lastRedisLatencyMs: permissionCacheRuntimeState.lastRedisLatencyMs,
    recomputePerMinute,
    consecutiveRedisFailures: permissionCacheRuntimeState.consecutiveRedisFailures,
  } as const;
};

export const readResourceType = (permissionKey: string) => permissionKey.split('.')[0] ?? permissionKey;

const SOURCE_KIND_ORDER: Record<NonNullable<PermissionRow['source_kind']>, number> = {
  direct_role: 0,
  group_role: 1,
};

const sortStrings = (values: readonly string[]): readonly string[] => [...values].sort((left, right) => left.localeCompare(right));

const sortSourceKinds = (
  values: readonly NonNullable<PermissionRow['source_kind']>[]
): readonly NonNullable<PermissionRow['source_kind']>[] =>
  [...values].sort((left, right) => SOURCE_KIND_ORDER[left] - SOURCE_KIND_ORDER[right] || left.localeCompare(right));

export const toEffectivePermissions = (rows: readonly PermissionRow[]): EffectivePermission[] => {
  const buckets = new Map<string, EffectivePermission>();

  for (const row of rows) {
    const action = row.action?.trim() || row.permission_key;
    const resourceType = row.resource_type?.trim() || readResourceType(row.permission_key);
    const resourceId = row.resource_id?.trim() || undefined;
    const effect = row.effect ?? 'allow';
    const scope = row.scope ?? undefined;
    const groupId = row.group_id ?? undefined;
    const groupKey = row.group_key ?? undefined;
    const bucketKey = JSON.stringify({
      action,
      resourceType,
      resourceId,
      organizationId: row.organization_id ?? '',
      effect,
      scope,
    });
    const existing = buckets.get(bucketKey);

    if (!existing) {
      buckets.set(bucketKey, {
        action,
        resourceType,
        resourceId,
        organizationId: row.organization_id ?? undefined,
        effect,
        scope,
        sourceRoleIds: [row.role_id],
        sourceGroupIds: groupId ? [groupId] : [],
        ...(groupKey ? { groupName: groupKey } : {}),
        provenance: row.source_kind ? { sourceKinds: [row.source_kind] } : undefined,
      });
      continue;
    }

    const sourceRoleIds = existing.sourceRoleIds.includes(row.role_id) ? existing.sourceRoleIds : [...existing.sourceRoleIds, row.role_id];
    const sourceGroupIds =
      groupId && !existing.sourceGroupIds.includes(groupId) ? [...existing.sourceGroupIds, groupId] : existing.sourceGroupIds;
    const groupName = groupKey ?? existing.groupName;
    const sourceKinds = row.source_kind
      ? sortSourceKinds(Array.from(new Set([...(existing.provenance?.sourceKinds ?? []), row.source_kind])))
      : existing.provenance?.sourceKinds;

    buckets.set(bucketKey, {
      ...existing,
      sourceRoleIds: sortStrings(sourceRoleIds),
      sourceGroupIds: sortStrings(sourceGroupIds),
      ...(groupName ? { groupName } : {}),
      provenance: sourceKinds ? { ...(existing.provenance ?? {}), sourceKinds } : existing.provenance,
    });
  }

  return [...buckets.values()].map((permission) => ({
    ...permission,
    sourceRoleIds: sortStrings(permission.sourceRoleIds),
    sourceGroupIds: sortStrings(permission.sourceGroupIds),
    provenance: permission.provenance?.sourceKinds
      ? { ...permission.provenance, sourceKinds: sortSourceKinds(permission.provenance.sourceKinds) }
      : permission.provenance,
  }));
};

export const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withInstanceDb(resolvePool, instanceId, work);

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
      iamCacheInvalidationLatencyHistogram.record(Date.now() - receivedAt, { trigger: parsed.trigger });
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
  provenance: {
    hasGroupDerivedPermissions: input.permissions.some((permission) => permission.sourceGroupIds.length > 0),
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
