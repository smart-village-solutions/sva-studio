import type {
  AuthorizeRequest,
  AuthorizeResponse,
  EffectivePermission,
  IamApiErrorCode,
  IamApiErrorResponse,
  MePermissionsResponse,
} from '@sva/core';
import { evaluateAuthorizeDecision } from '@sva/core';
import { createSdkLogger, getWorkspaceContext, withRequestContext } from '@sva/sdk/server';
import { metrics } from '@opentelemetry/api';
import { Pool, type PoolClient } from 'pg';

import { parseInvalidationEvent, PermissionSnapshotCache } from './iam-authorization.cache';
import { withAuthenticatedUser } from './middleware.server';

export { evaluateAuthorizeDecision } from '@sva/core';

const logger = createSdkLogger({ component: 'iam-authorize', level: 'info' });
const cacheLogger = createSdkLogger({ component: 'iam-cache', level: 'info' });
const authMeter = metrics.getMeter('sva.auth');
const iamAuthorizeLatencyHistogram = authMeter.createHistogram('sva_iam_authorize_duration_ms', {
  description: 'Latency distribution for IAM authorize decisions in milliseconds.',
  unit: 'ms',
});
const iamCacheLookupCounter = authMeter.createCounter('sva_iam_cache_lookup_total', {
  description: 'Cache lookups for IAM authorization snapshots.',
});
const iamCacheInvalidationLatencyHistogram = authMeter.createHistogram(
  'sva_iam_cache_invalidation_duration_ms',
  {
    description: 'End-to-end latency for IAM cache invalidation events.',
    unit: 'ms',
  }
);
const iamCacheStaleEntriesGauge = authMeter.createObservableGauge('sva_iam_cache_stale_entry_rate', {
  description: 'Ratio of stale cache lookups in IAM authorization path.',
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PermissionRow = {
  permission_key: string;
  role_id: string;
  organization_id: string | null;
};

type QueryResult<TRow> = {
  rowCount: number;
  rows: TRow[];
};

type QueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
};

let iamPool: Pool | null = null;
const permissionSnapshotCache = new PermissionSnapshotCache(300_000, 300_000);
const CACHE_INVALIDATION_CHANNEL = 'iam_permission_snapshot_invalidation';
const cacheMetricsState = {
  lookups: 0,
  staleLookups: 0,
};
let invalidationListenerInit: Promise<void> | null = null;
let invalidationListenerClient: PoolClient | null = null;

iamCacheStaleEntriesGauge.addCallback((result) => {
  const staleRate =
    cacheMetricsState.lookups === 0 ? 0 : cacheMetricsState.staleLookups / cacheMetricsState.lookups;
  result.observe(staleRate);
});

const resolvePool = (): Pool | null => {
  const databaseUrl = process.env.IAM_DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  if (!iamPool) {
    iamPool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }

  return iamPool;
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const isUuid = (value: string) => UUID_PATTERN.test(value);

const buildRequestContext = (workspaceId?: string) => {
  const context = getWorkspaceContext();
  return {
    workspace_id: workspaceId ?? context.workspaceId ?? 'default',
    request_id: context.requestId,
    trace_id: context.traceId,
  };
};

const readResourceType = (permissionKey: string) => permissionKey.split('.')[0] ?? permissionKey;

const toEffectivePermissions = (rows: readonly PermissionRow[]): EffectivePermission[] => {
  const buckets = new Map<string, EffectivePermission>();

  for (const row of rows) {
    const resourceType = readResourceType(row.permission_key);
    const bucketKey = `${row.permission_key}|${resourceType}|${row.organization_id ?? ''}`;
    const existing = buckets.get(bucketKey);
    if (!existing) {
      buckets.set(bucketKey, {
        action: row.permission_key,
        resourceType,
        organizationId: row.organization_id ?? undefined,
        sourceRoleIds: [row.role_id],
      });
      continue;
    }

    if (!existing.sourceRoleIds.includes(row.role_id)) {
      buckets.set(bucketKey, {
        ...existing,
        sourceRoleIds: [...existing.sourceRoleIds, row.role_id],
      });
    }
  }

  return [...buckets.values()];
};

const listPermissionRows = async (
  client: QueryClient,
  input: {
    instanceId: string;
    keycloakSubject: string;
    organizationId?: string;
  }
): Promise<readonly PermissionRow[]> => {
  if (input.organizationId) {
    const scopedQuery = await client.query<PermissionRow>(
      `
SELECT
  p.permission_key,
  ar.role_id,
  $3::uuid AS organization_id
FROM iam.accounts a
JOIN iam.account_roles ar
  ON ar.account_id = a.id
 AND ar.instance_id = $1
JOIN iam.role_permissions rp
  ON rp.instance_id = ar.instance_id
 AND rp.role_id = ar.role_id
JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE a.keycloak_subject = $2
  AND EXISTS (
    SELECT 1
    FROM iam.account_organizations ao
    WHERE ao.instance_id = ar.instance_id
      AND ao.account_id = ar.account_id
      AND ao.organization_id = $3::uuid
  );
`,
      [input.instanceId, input.keycloakSubject, input.organizationId]
    );

    return scopedQuery.rows;
  }

  const unscopedQuery = await client.query<PermissionRow>(
    `
SELECT DISTINCT
  p.permission_key,
  ar.role_id,
  NULL::uuid AS organization_id
FROM iam.accounts a
JOIN iam.account_roles ar
  ON ar.account_id = a.id
 AND ar.instance_id = $1
JOIN iam.role_permissions rp
  ON rp.instance_id = ar.instance_id
 AND rp.role_id = ar.role_id
JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE a.keycloak_subject = $2;
`,
    [input.instanceId, input.keycloakSubject]
  );

  return unscopedQuery.rows;
};

const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => {
  const pool = resolvePool();
  if (!pool) {
    throw new Error('IAM database not configured');
  }

  const client = (await pool.connect()) as PoolClient & QueryClient;
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true);', ['app.instance_id', instanceId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
const ensureInvalidationListener = async (): Promise<void> => {
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

const loadPermissionsFromDb = async (input: {
  instanceId: string;
  keycloakSubject: string;
  organizationId?: string;
}): Promise<readonly EffectivePermission[]> => {
  const rows = await withInstanceScopedDb(input.instanceId, async (client) => listPermissionRows(client, input));
  return toEffectivePermissions(rows);
};

const resolveEffectivePermissions = async (input: {
  instanceId: string;
  keycloakSubject: string;
  organizationId?: string;
}): Promise<
  | { ok: true; permissions: readonly EffectivePermission[] }
  | { ok: false; error: 'database_unavailable' | 'cache_stale_guard' }
> => {
  await ensureInvalidationListener();

  cacheMetricsState.lookups += 1;
  const lookup = permissionSnapshotCache.get(input);

  if (lookup.status === 'hit' && lookup.snapshot) {
    iamCacheLookupCounter.add(1, { hit: true });
    cacheLogger.debug('Permission snapshot cache lookup', {
      operation: 'cache_lookup',
      hit: true,
      ttl_remaining_s: lookup.ttlRemainingSeconds,
      ...buildRequestContext(input.instanceId),
    });
    return { ok: true, permissions: lookup.snapshot.permissions };
  }

  iamCacheLookupCounter.add(1, { hit: false });
  cacheLogger.debug('Permission snapshot cache lookup', {
    operation: 'cache_lookup',
    hit: false,
    ...buildRequestContext(input.instanceId),
  });
  if (lookup.status === 'stale') {
    cacheMetricsState.staleLookups += 1;
    cacheLogger.warn('Stale permission snapshot detected', {
      operation: 'cache_stale_detected',
      age_s: lookup.ageSeconds,
      max_ttl_s: 300,
      ...buildRequestContext(input.instanceId),
    });
  }

  try {
    const permissions = await loadPermissionsFromDb(input);
    permissionSnapshotCache.set(input, permissions);
    if (lookup.status === 'stale') {
      cacheLogger.info('Permission snapshot recomputed after stale detection', {
        operation: 'cache_invalidate',
        trigger: 'recompute',
        affected_keys: 1,
        ...buildRequestContext(input.instanceId),
      });
    }
    return { ok: true, permissions };
  } catch (error) {
    cacheLogger.error('Failed to recompute permission snapshot', {
      operation: 'cache_invalidate_failed',
      error: error instanceof Error ? error.message : String(error),
      ...buildRequestContext(input.instanceId),
    });
    if (lookup.status === 'stale') {
      return { ok: false, error: 'cache_stale_guard' };
    }
    return { ok: false, error: 'database_unavailable' };
  }
};

const parseAuthorizeRequest = async (request: Request): Promise<AuthorizeRequest | null> => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return null;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const typed = payload as Record<string, unknown>;
  const instanceId = readString(typed.instanceId);
  const action = readString(typed.action);
  const resourceRaw = typed.resource;
  if (!instanceId || !action || !resourceRaw || typeof resourceRaw !== 'object') {
    return null;
  }

  const resourceTyped = resourceRaw as Record<string, unknown>;
  const resourceType = readString(resourceTyped.type);
  if (!resourceType) {
    return null;
  }

  const contextRaw = typed.context;
  const contextTyped = contextRaw && typeof contextRaw === 'object'
    ? (contextRaw as Record<string, unknown>)
    : undefined;

  return {
    instanceId,
    action,
    resource: {
      type: resourceType,
      id: readString(resourceTyped.id),
      organizationId: readString(resourceTyped.organizationId),
      attributes:
        resourceTyped.attributes && typeof resourceTyped.attributes === 'object'
          ? (resourceTyped.attributes as Record<string, unknown>)
          : undefined,
    },
    context: contextTyped
      ? {
          organizationId: readString(contextTyped.organizationId),
          requestId: readString(contextTyped.requestId),
          traceId: readString(contextTyped.traceId),
          actingAsUserId: readString(contextTyped.actingAsUserId),
          attributes:
            contextTyped.attributes && typeof contextTyped.attributes === 'object'
              ? (contextTyped.attributes as Record<string, unknown>)
              : undefined,
        }
      : undefined,
  };
};

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const errorResponse = (status: number, error: IamApiErrorCode) =>
  jsonResponse(status, { error } satisfies IamApiErrorResponse);

const resolveInstanceIdFromRequest = (request: Request, userInstanceId?: string) => {
  const url = new URL(request.url);
  return readString(url.searchParams.get('instanceId')) ?? userInstanceId;
};

const resolveOrganizationIdFromRequest = (request: Request) => {
  const url = new URL(request.url);
  const organizationId = readString(url.searchParams.get('organizationId'));
  if (!organizationId) {
    return undefined;
  }
  return isUuid(organizationId) ? organizationId : null;
};

export const mePermissionsHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const instanceId = resolveInstanceIdFromRequest(request, user.instanceId);
      if (!instanceId || !isUuid(instanceId)) {
        return errorResponse(400, 'invalid_instance_id');
      }

      if (user.instanceId && user.instanceId !== instanceId) {
        return errorResponse(403, 'instance_scope_mismatch');
      }

      const organizationId = resolveOrganizationIdFromRequest(request);
      if (organizationId === null) {
        return errorResponse(400, 'invalid_organization_id');
      }

      const resolved = await resolveEffectivePermissions({
        instanceId,
        keycloakSubject: user.id,
        organizationId: organizationId ?? undefined,
      });
      if (!resolved.ok) {
        logger.error('Failed to resolve permissions from cache/database', {
          operation: 'me_permissions',
          error: resolved.error,
          ...buildRequestContext(instanceId),
        });
        return resolved.error === 'cache_stale_guard'
          ? jsonResponse(200, {
              instanceId,
              organizationId: organizationId ?? undefined,
              permissions: [] as EffectivePermission[],
              evaluatedAt: new Date().toISOString(),
              requestId: getWorkspaceContext().requestId,
              traceId: getWorkspaceContext().traceId,
            } satisfies MePermissionsResponse)
          : errorResponse(503, 'database_unavailable');
      }

      const response: MePermissionsResponse = {
        instanceId,
        organizationId: organizationId ?? undefined,
        permissions: resolved.permissions,
        evaluatedAt: new Date().toISOString(),
        requestId: getWorkspaceContext().requestId,
        traceId: getWorkspaceContext().traceId,
      };

      logger.debug('Resolved effective permissions for current user', {
        operation: 'me_permissions',
        permission_count: response.permissions.length,
        ...buildRequestContext(instanceId),
      });

      return jsonResponse(200, response);
    });
  });
};

export const authorizeHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const startedAt = performance.now();
      const recordLatency = (decisionAllowed: boolean, reason: string) => {
        iamAuthorizeLatencyHistogram.record(performance.now() - startedAt, {
          allowed: decisionAllowed,
          reason,
          endpoint: '/iam/authorize',
        });
      };

      const payload = await parseAuthorizeRequest(request);
      if (!payload) {
        recordLatency(false, 'invalid_request');
        return errorResponse(400, 'invalid_request');
      }

      if (!isUuid(payload.instanceId)) {
        recordLatency(false, 'invalid_instance_id');
        return errorResponse(400, 'invalid_instance_id');
      }

      if (user.instanceId && user.instanceId !== payload.instanceId) {
        const denied: AuthorizeResponse = {
          allowed: false,
          reason: 'instance_scope_mismatch',
          instanceId: payload.instanceId,
          action: payload.action,
          resourceType: payload.resource.type,
          resourceId: payload.resource.id,
          evaluatedAt: new Date().toISOString(),
          requestId: payload.context?.requestId ?? getWorkspaceContext().requestId,
          traceId: payload.context?.traceId ?? getWorkspaceContext().traceId,
        };
        recordLatency(denied.allowed, denied.reason);
        return jsonResponse(200, denied);
      }

      const resolved = await resolveEffectivePermissions({
        instanceId: payload.instanceId,
        keycloakSubject: user.id,
        organizationId: payload.context?.organizationId ?? payload.resource.organizationId,
      });
      if (!resolved.ok) {
        logger.error('Failed to evaluate authorize decision from cache/database', {
          operation: 'authorize',
          error: resolved.error,
          ...buildRequestContext(payload.instanceId),
        });
        if (resolved.error === 'cache_stale_guard') {
          const denied: AuthorizeResponse = {
            allowed: false,
            reason: 'cache_stale_guard',
            instanceId: payload.instanceId,
            action: payload.action,
            resourceType: payload.resource.type,
            resourceId: payload.resource.id,
            evaluatedAt: new Date().toISOString(),
            requestId: payload.context?.requestId ?? getWorkspaceContext().requestId,
            traceId: payload.context?.traceId ?? getWorkspaceContext().traceId,
          };
          recordLatency(false, denied.reason);
          return jsonResponse(200, denied);
        }
        recordLatency(false, 'database_unavailable');
        return errorResponse(503, 'database_unavailable');
      }
      const decision = evaluateAuthorizeDecision(payload, resolved.permissions);

      logger[decision.allowed ? 'debug' : 'warn']('Authorize decision evaluated', {
        operation: 'authorize',
        allowed: decision.allowed,
        reason: decision.reason,
        action: payload.action,
        resource_type: payload.resource.type,
        ...buildRequestContext(payload.instanceId),
      });
      recordLatency(decision.allowed, decision.reason);

      return jsonResponse(200, {
        ...decision,
        requestId: decision.requestId ?? getWorkspaceContext().requestId,
        traceId: decision.traceId ?? getWorkspaceContext().traceId,
      });
    });
  });
};
