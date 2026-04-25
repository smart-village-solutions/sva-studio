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
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { metrics } from '@opentelemetry/api';
import type { PoolClient } from 'pg';

import { parseInvalidationEvent, PermissionSnapshotCache } from '../iam-authorization-cache.js';
import { processSnapshotInvalidationEvent } from './snapshot-invalidation.server.js';
import { createPoolResolver, jsonResponse, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import { isUuid, readString } from '../shared/input-readers.js';
import { buildLogContext } from '../log-context.js';
import { authorizeRequestSchema } from '../shared/schemas.js';
import {
  cacheMetricsState,
  buildPermissionCacheColdStartLog,
  markPermissionCacheColdStart,
} from './shared-cache-health.js';
export {
  cacheMetricsState,
  getPermissionCacheHealth,
  permissionCacheRuntimeState,
  recordPermissionCacheRecompute,
  recordPermissionCacheRedisLatency,
} from './shared-cache-health.js';

export type PermissionRow = {
  permission_key: string;
  action?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  effect?: IamPermissionEffect | null;
  scope?: Record<string, unknown> | null;
  account_id?: string | null;
  role_id?: string | null;
  organization_id: string | null;
  group_id?: string | null;
  group_key?: string | null;
  source_kind?: 'direct_user' | 'direct_role' | 'group_role' | null;
};

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

export const resolvePool = createPoolResolver(getIamDatabaseUrl);
export const permissionSnapshotCache = new PermissionSnapshotCache(300_000, 300_000);
export const CACHE_INVALIDATION_CHANNEL = 'iam_permission_snapshot_invalidation';

let invalidationListenerInit: Promise<void> | null = null;
let invalidationListenerClient: PoolClient | null = null;

iamCacheStaleEntriesGauge.addCallback((result) => {
  const staleRate =
    cacheMetricsState.lookups === 0 ? 0 : cacheMetricsState.staleLookups / cacheMetricsState.lookups;
  result.observe(staleRate);
});

export const buildRequestContext = (workspaceId?: string) => buildLogContext(workspaceId, { includeTraceId: true });

export const recordPermissionCacheColdStart = (instanceId: string): void => {
  if (!markPermissionCacheColdStart()) {
    return;
  }

  const coldStartLog = buildPermissionCacheColdStartLog(instanceId);
  cacheLogger.info(coldStartLog.message, coldStartLog.attributes);
};

export const readResourceType = (permissionKey: string) => permissionKey.split('.')[0] ?? permissionKey;

const SOURCE_KIND_ORDER: Record<NonNullable<PermissionRow['source_kind']>, number> = {
  direct_user: 0,
  direct_role: 1,
  group_role: 2,
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
    const accountId = row.account_id ?? undefined;
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
        ...(accountId ? { sourceUserIds: [accountId] } : {}),
        ...(row.role_id ? { sourceRoleIds: [row.role_id] } : {}),
        ...(groupId ? { sourceGroupIds: [groupId] } : {}),
        ...(groupKey ? { groupName: groupKey } : {}),
        provenance: row.source_kind ? { sourceKinds: [row.source_kind] } : undefined,
      });
      continue;
    }

    const sourceUserIds =
      accountId && !(existing.sourceUserIds ?? []).includes(accountId)
        ? [...(existing.sourceUserIds ?? []), accountId]
        : existing.sourceUserIds;
    const sourceRoleIds =
      row.role_id && !(existing.sourceRoleIds ?? []).includes(row.role_id)
        ? [...(existing.sourceRoleIds ?? []), row.role_id]
        : existing.sourceRoleIds;
    const sourceGroupIds =
      groupId && !(existing.sourceGroupIds ?? []).includes(groupId)
        ? [...(existing.sourceGroupIds ?? []), groupId]
        : existing.sourceGroupIds;
    const groupName = groupKey ?? existing.groupName;
    const sourceKinds = row.source_kind
      ? sortSourceKinds(Array.from(new Set([...(existing.provenance?.sourceKinds ?? []), row.source_kind])))
      : existing.provenance?.sourceKinds;

    buckets.set(bucketKey, {
      ...existing,
      ...(sourceUserIds ? { sourceUserIds: sortStrings(sourceUserIds) } : {}),
      ...(sourceRoleIds ? { sourceRoleIds: sortStrings(sourceRoleIds) } : {}),
      ...(sourceGroupIds ? { sourceGroupIds: sortStrings(sourceGroupIds) } : {}),
      ...(groupName ? { groupName } : {}),
      provenance: sourceKinds ? { ...(existing.provenance ?? {}), sourceKinds } : existing.provenance,
    });
  }

  return [...buckets.values()].map((permission) => ({
    ...permission,
    ...(permission.sourceUserIds ? { sourceUserIds: sortStrings(permission.sourceUserIds) } : {}),
    ...(permission.sourceRoleIds ? { sourceRoleIds: sortStrings(permission.sourceRoleIds) } : {}),
    ...(permission.sourceGroupIds ? { sourceGroupIds: sortStrings(permission.sourceGroupIds) } : {}),
    provenance: permission.provenance?.sourceKinds
      ? { ...permission.provenance, sourceKinds: sortSourceKinds(permission.provenance.sourceKinds) }
      : permission.provenance,
  }));
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
    hasDirectUserPermissions: input.permissions.some((permission) => (permission.sourceUserIds?.length ?? 0) > 0),
    hasGroupDerivedPermissions: input.permissions.some((permission) => (permission.sourceGroupIds?.length ?? 0) > 0),
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
    url.searchParams
      .getAll('geoHierarchy')
      .flatMap((entry) => entry.split(','))
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
