import { randomUUID } from 'node:crypto';

import type { ApiErrorCode, IamRoleSyncState } from '@sva/core';
import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';
import { metrics } from '@opentelemetry/api';

import type { IdentityProviderPort } from '../identity-provider-port';
import {
  KeycloakAdminClient,
  getKeycloakAdminClientConfigFromEnv,
} from '../keycloak-admin-client';
import type { AuthenticatedRequestContext } from '../middleware.server';
import { jitProvisionAccountWithClient } from '../jit-provisioning.server';
import { createPoolResolver, type QueryClient, withInstanceDb } from '../shared/db-helpers';
import { resolveInstanceId } from '../shared/instance-id-resolution';

import { createApiError, readInstanceIdFromRequest } from './api-helpers';
import { sanitizeRoleAuditDetails } from './role-audit';
import type {
  ActorInfo,
  IamGroupRow,
  IdempotencyReserveResult,
  IdempotencyStatus,
  IamRoleRow,
  ResolveActorOptions,
} from './types';
export type { ActorInfo } from './types';

export const logger: ReturnType<typeof createSdkLogger> = createSdkLogger({
  component: 'iam-service',
  level: 'info',
});

const meter = metrics.getMeter('sva.iam.service');

export const iamUserOperationsCounter = meter.createCounter('iam_user_operations_total', {
  description: 'Counter for IAM user and role operations.',
});

const iamKeycloakRequestLatency = meter.createHistogram('iam_keycloak_request_duration_seconds', {
  description: 'Latency for outbound Keycloak admin operations.',
  unit: 's',
});

const iamCircuitBreakerGauge = meter.createObservableGauge('iam_circuit_breaker_state', {
  description: 'Circuit breaker state for Keycloak admin integration (0=closed, 2=open).',
});

export const iamRoleSyncCounter = meter.createCounter('iam_role_sync_operations_total', {
  description: 'Role catalog sync operations grouped by operation, result and error code.',
});

const iamRoleDriftBacklogGauge = meter.createObservableGauge('iam_role_drift_backlog', {
  description: 'Latest known drift backlog per instance from role catalog reconciliation.',
});

const roleDriftBacklogByInstance = new Map<string, number>();

export const resolvePool = createPoolResolver(() => process.env.IAM_DATABASE_URL);

let identityProviderCache:
  | {
      provider: IdentityProviderPort;
      getCircuitBreakerState?: () => number;
    }
  | null
  | undefined;

export const resolveIdentityProvider = () => {
  if (identityProviderCache !== undefined) {
    return identityProviderCache;
  }

  try {
    const config = getKeycloakAdminClientConfigFromEnv();
    const client = new KeycloakAdminClient(config);
    identityProviderCache = {
      provider: client,
      getCircuitBreakerState: () => client.getCircuitBreakerState(),
    };
  } catch {
    identityProviderCache = null;
  }

  return identityProviderCache;
};

export const isKeycloakIdentityProvider = (
  provider: IdentityProviderPort
): provider is KeycloakAdminClient => provider instanceof KeycloakAdminClient;

iamCircuitBreakerGauge.addCallback((result) => {
  const idp = resolveIdentityProvider();
  result.observe(idp?.getCircuitBreakerState ? idp.getCircuitBreakerState() : 0);
});

iamRoleDriftBacklogGauge.addCallback((result) => {
  for (const [instanceId, backlog] of roleDriftBacklogByInstance.entries()) {
    result.observe(backlog, { instance_id: instanceId });
  }
});

export const setRoleDriftBacklog = (instanceId: string, backlog: number): void => {
  roleDriftBacklogByInstance.set(instanceId, backlog);
};

export const trackKeycloakCall = async <T>(operation: string, execute: () => Promise<T>): Promise<T> => {
  const startedAt = Date.now();
  try {
    const result = await execute();
    iamKeycloakRequestLatency.record((Date.now() - startedAt) / 1000, { operation, result: 'success' });
    return result;
  } catch (error) {
    iamKeycloakRequestLatency.record((Date.now() - startedAt) / 1000, { operation, result: 'failure' });
    throw error;
  }
};

export const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withInstanceDb(resolvePool, instanceId, work);

export const resolveActorAccountId = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<string | undefined> => {
  const row = await client.query<{ account_id: string }>(
    `
SELECT a.id AS account_id
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );
  return row.rows[0]?.account_id;
};

export const resolveActorMaxRoleLevel = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string; sessionRoleNames?: readonly string[] }
): Promise<number> => {
  const row = await client.query<{ max_role_level: number }>(
    `
SELECT COALESCE(MAX(r.role_level), 0)::int AS max_role_level
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE a.keycloak_subject = $2;
`,
    [input.instanceId, input.keycloakSubject]
  );
  const persistedMaxRoleLevel = row.rows[0]?.max_role_level ?? 0;
  const normalizedSessionRoleNames =
    input.sessionRoleNames
      ?.map((roleName) => roleName.trim())
      .filter((roleName) => roleName.length > 0) ?? [];

  if (normalizedSessionRoleNames.includes('system_admin')) {
    return Math.max(persistedMaxRoleLevel, 100);
  }

  if (normalizedSessionRoleNames.length === 0) {
    return persistedMaxRoleLevel;
  }

  const sessionRoles = await resolveRolesByExternalNames(client, {
    instanceId: input.instanceId,
    externalRoleNames: normalizedSessionRoleNames,
  });
  const sessionMaxRoleLevel = sessionRoles.reduce(
    (maxRoleLevel, role) => Math.max(maxRoleLevel, role.role_level),
    0
  );

  return Math.max(persistedMaxRoleLevel, sessionMaxRoleLevel);
};

export const resolveRolesByIds = async (
  client: QueryClient,
  input: { instanceId: string; roleIds: readonly string[] }
): Promise<readonly IamRoleRow[]> => {
  if (input.roleIds.length === 0) {
    return [];
  }

  const result = await client.query<IamRoleRow>(
    `
SELECT id, role_key, role_name, display_name, external_role_name, role_level, is_system_role
FROM iam.roles
WHERE instance_id = $1
  AND id = ANY($2::uuid[]);
`,
    [input.instanceId, input.roleIds]
  );
  return result.rows;
};

export const resolveRolesByExternalNames = async (
  client: QueryClient,
  input: { instanceId: string; externalRoleNames: readonly string[] }
): Promise<readonly IamRoleRow[]> => {
  if (input.externalRoleNames.length === 0) {
    return [];
  }

  const result = await client.query<IamRoleRow>(
    `
SELECT id, role_key, role_name, display_name, external_role_name, role_level, is_system_role
FROM iam.roles
WHERE instance_id = $1
  AND COALESCE(external_role_name, role_key) = ANY($2::text[]);
`,
    [input.instanceId, input.externalRoleNames]
  );
  return result.rows;
};

export const resolveGroupsByIds = async (
  client: QueryClient,
  input: { instanceId: string; groupIds: readonly string[] }
): Promise<readonly IamGroupRow[]> => {
  const uniqueGroupIds = [...new Set(input.groupIds)];
  if (uniqueGroupIds.length === 0) {
    return [];
  }

  const result = await client.query<IamGroupRow>(
    `
SELECT id, group_key, display_name, description, group_type, is_active
FROM iam.groups
WHERE instance_id = $1
  AND is_active = true
  AND id = ANY($2::uuid[]);
`,
    [input.instanceId, uniqueGroupIds]
  );

  return result.rows;
};

export const resolveRoleIdsForGroups = async (
  client: QueryClient,
  input: { instanceId: string; groupIds: readonly string[] }
): Promise<readonly string[]> => {
  const uniqueGroupIds = [...new Set(input.groupIds)];
  if (uniqueGroupIds.length === 0) {
    return [];
  }

  const result = await client.query<{ role_id: string }>(
    `
SELECT DISTINCT gr.role_id
FROM iam.group_roles gr
JOIN iam.groups g
  ON g.instance_id = gr.instance_id
 AND g.id = gr.group_id
 AND g.is_active = true
WHERE gr.instance_id = $1
  AND gr.group_id = ANY($2::uuid[]);
`,
    [input.instanceId, uniqueGroupIds]
  );

  return result.rows.map((row) => row.role_id);
};

const canAssignRoles = (input: {
  actorMaxRoleLevel: number;
  targetRoles: readonly IamRoleRow[];
}): boolean => input.targetRoles.every((role) => role.role_level <= input.actorMaxRoleLevel);

export const ensureActorCanManageTarget = (input: {
  actorMaxRoleLevel: number;
  actorRoles: readonly string[];
  targetRoles: readonly {
    roleKey: string;
    roleLevel: number;
  }[];
}): { ok: true } | { ok: false; code: ApiErrorCode; message: string } => {
  if (input.actorRoles.includes('system_admin')) {
    return { ok: true };
  }

  const targetMaxRoleLevel = input.targetRoles.reduce((maxLevel, role) => Math.max(maxLevel, role.roleLevel), 0);
  if (targetMaxRoleLevel > input.actorMaxRoleLevel) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Zielnutzer überschreitet die eigene Berechtigungsstufe.',
    };
  }

  const targetHasSystemAdmin = input.targetRoles.some((role) => role.roleKey === 'system_admin');
  const actorIsSystemAdmin = input.actorRoles.includes('system_admin');
  if (targetHasSystemAdmin && !actorIsSystemAdmin) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Nur system_admin darf system_admin-Nutzer verwalten.',
    };
  }

  return { ok: true };
};

export const resolveSystemAdminCount = async (client: QueryClient, instanceId: string): Promise<number> => {
  const result = await client.query<{ admin_count: number }>(
    `
SELECT COUNT(DISTINCT a.id)::int AS admin_count
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE a.status = 'active'
    AND r.role_key = 'system_admin';
`,
    [instanceId]
  );
  return result.rows[0]?.admin_count ?? 0;
};

export const isSystemAdminAccount = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<boolean> => {
  const result = await client.query<{ has_role: boolean }>(
    `
SELECT EXISTS (
  SELECT 1
  FROM iam.account_roles ar
  JOIN iam.roles r
    ON r.instance_id = ar.instance_id
   AND r.id = ar.role_id
  WHERE ar.instance_id = $1
    AND ar.account_id = $2::uuid
    AND ar.valid_from <= NOW()
    AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
    AND r.role_key = 'system_admin'
) AS has_role;
`,
    [input.instanceId, input.accountId]
  );
  return Boolean(result.rows[0]?.has_role);
};

export const emitActivityLog = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId?: string;
    subjectId?: string;
    eventType: string;
    result: 'success' | 'failure';
    payload?: Record<string, unknown>;
    requestId?: string;
    traceId?: string;
  }
) => {
  await client.query(
    `
INSERT INTO iam.activity_logs (
  instance_id,
  account_id,
  subject_id,
  event_type,
  result,
  payload,
  request_id,
  trace_id
)
VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7, $8);
`,
    [
      input.instanceId,
      input.accountId ?? null,
      input.subjectId ?? null,
      input.eventType,
      input.result,
      JSON.stringify(input.payload ?? {}),
      input.requestId ?? null,
      input.traceId ?? null,
    ]
  );
};

export const emitRoleAuditEvent = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId?: string;
    roleId?: string;
    eventType: 'role.sync_started' | 'role.sync_succeeded' | 'role.sync_failed' | 'role.reconciled';
    operation: string;
    result: 'success' | 'failure';
    roleKey?: string;
    externalRoleName?: string;
    errorCode?: string;
    details?: Record<string, unknown>;
    requestId?: string;
    traceId?: string;
  }
) => {
  const sanitizedDetails = sanitizeRoleAuditDetails(input.details);
  await emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.accountId,
    eventType: input.eventType,
    result: input.result,
    payload: {
      workspace_id: input.instanceId,
      operation: input.operation,
      result: input.result,
      ...(input.roleId ? { role_id: input.roleId } : {}),
      ...(input.roleKey ? { role_key: input.roleKey } : {}),
      ...(input.externalRoleName ? { external_role_name: input.externalRoleName } : {}),
      ...(input.errorCode ? { error_code: input.errorCode } : {}),
      ...(input.requestId ? { request_id: input.requestId } : {}),
      ...(input.traceId ? { trace_id: input.traceId } : {}),
      ...sanitizedDetails,
    },
    requestId: input.requestId,
    traceId: input.traceId,
  });
};

export const setRoleSyncState = async (
  client: QueryClient,
  input: {
    instanceId: string;
    roleId: string;
    syncState: IamRoleSyncState;
    errorCode?: string | null;
    syncedAt?: boolean;
  }
) => {
  await client.query(
    `
UPDATE iam.roles
SET
  sync_state = $3,
  last_error_code = $4,
  last_synced_at = CASE WHEN $5::boolean THEN NOW() ELSE last_synced_at END,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
    [input.instanceId, input.roleId, input.syncState, input.errorCode ?? null, input.syncedAt ?? false]
  );
};

export const notifyPermissionInvalidation = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject?: string; trigger: string }
) => {
  await client.query('SELECT pg_notify($1, $2);', [
    'iam_permission_snapshot_invalidation',
    JSON.stringify({
      eventId: randomUUID(),
      instanceId: input.instanceId,
      ...(input.keycloakSubject ? { keycloakSubject: input.keycloakSubject } : {}),
      trigger: 'pg_notify',
      reason: input.trigger,
    }),
  ]);
};

export const reserveIdempotency = async (input: {
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
  payloadHash: string;
}): Promise<IdempotencyReserveResult> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query('DELETE FROM iam.idempotency_keys WHERE expires_at < NOW();');

    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      `${input.instanceId}:${input.actorAccountId}`,
      `${input.endpoint}:${input.idempotencyKey}`,
    ]);

    const existing = await client.query<{
      status: IdempotencyStatus;
      payload_hash: string;
      response_status: number | null;
      response_body: unknown;
    }>(
      `
SELECT status, payload_hash, response_status, response_body
FROM iam.idempotency_keys
WHERE instance_id = $1
  AND actor_account_id = $2::uuid
  AND endpoint = $3
  AND idempotency_key = $4
LIMIT 1;
`,
      [input.instanceId, input.actorAccountId, input.endpoint, input.idempotencyKey]
    );

    const row = existing.rows[0];
    if (!row) {
      await client.query(
      `
INSERT INTO iam.idempotency_keys (
  instance_id,
  actor_account_id,
  endpoint,
  idempotency_key,
  payload_hash,
  status,
  expires_at
)
VALUES ($1, $2::uuid, $3, $4, $5, 'IN_PROGRESS', NOW() + INTERVAL '24 hours')
`,
        [input.instanceId, input.actorAccountId, input.endpoint, input.idempotencyKey, input.payloadHash]
      );
      return { status: 'reserved' };
    }

    if (row.payload_hash !== input.payloadHash) {
      return {
        status: 'conflict',
        message: 'Idempotency-Key wurde bereits mit anderem Payload verwendet.',
      };
    }

    if (row.status === 'IN_PROGRESS') {
      return {
        status: 'conflict',
        message: 'Idempotenter Request wird bereits verarbeitet.',
      };
    }

    return {
      status: 'replay',
      responseStatus: row.response_status ?? 200,
      responseBody: row.response_body,
    };
  });

export const completeIdempotency = async (input: {
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
  status: IdempotencyStatus;
  responseStatus: number;
  responseBody: unknown;
}) => {
  await withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query(
      `
UPDATE iam.idempotency_keys
SET
  status = $5,
  response_status = $6,
  response_body = $7::jsonb,
  updated_at = NOW(),
  expires_at = NOW() + INTERVAL '24 hours'
WHERE actor_account_id = $1::uuid
  AND instance_id = $2
  AND endpoint = $3
  AND idempotency_key = $4;
`,
      [
        input.actorAccountId,
        input.instanceId,
        input.endpoint,
        input.idempotencyKey,
        input.status,
        input.responseStatus,
        JSON.stringify(input.responseBody),
      ]
    );
  });
};

export const requireRoles = (
  ctx: AuthenticatedRequestContext,
  roles: ReadonlySet<string>,
  requestId?: string
) => {
  const hasRole = ctx.user.roles.some((role) => roles.has(role));
  if (!hasRole) {
    logger.warn('IAM role guard rejected request', {
      operation: 'require_roles',
      required_roles: [...roles],
      user_roles: ctx.user.roles,
      session_instance_id: ctx.user.instanceId,
      request_id: requestId,
    });
    return createApiError(403, 'forbidden', 'Unzureichende Berechtigungen.', requestId);
  }
  return null;
};

const resolveActorInstanceId = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  options?: ResolveActorOptions
)=> {
  const explicitInstanceId = new URL(request.url).searchParams.get('instanceId') ?? undefined;
  const requestedInstanceId = readInstanceIdFromRequest(request, ctx.user.instanceId);
  if (requestedInstanceId !== undefined) {
    if (options?.createMissingInstanceFromKey !== true || explicitInstanceId === undefined) {
      return {
        ok: true as const,
        instanceId: requestedInstanceId,
        fromInstanceKey: false,
        created: false,
      };
    }
  }

  return resolveInstanceId({
    resolvePool,
    candidate: requestedInstanceId,
    createIfMissingFromKey: options?.createMissingInstanceFromKey,
    displayNameForCreate: requestedInstanceId,
  });
};

export const resolveActorInfo = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  options?: ResolveActorOptions
): Promise<{ actor: ActorInfo } | { error: Response }> => {
  const requestedInstanceId = readInstanceIdFromRequest(request, ctx.user.instanceId);
  const requestContext = getWorkspaceContext();
  const resolvedInstance = await resolveActorInstanceId(request, ctx, options);
  if (!resolvedInstance.ok) {
    const status = resolvedInstance.reason === 'database_unavailable' ? 503 : 400;
    const code = resolvedInstance.reason === 'database_unavailable' ? 'database_unavailable' : 'invalid_instance_id';
    const message =
      resolvedInstance.reason === 'database_unavailable'
        ? 'IAM-Datenbank ist nicht erreichbar.'
        : 'Ungültige oder fehlende instanceId.';
    logger.warn('IAM actor resolution failed during instance lookup', {
      operation: 'resolve_actor',
      requested_instance_id: requestedInstanceId,
      session_instance_id: ctx.user.instanceId,
      reason_code: code,
      request_id: requestContext.requestId,
      trace_id: requestContext.traceId,
    });
    return {
      error: createApiError(status, code, message, requestContext.requestId),
    };
  }

  const instanceId = resolvedInstance.instanceId;
  const mayProvisionMissingActorMembership =
    options?.provisionMissingActorMembership === true &&
    (!requestedInstanceId || requestedInstanceId === ctx.user.instanceId);

  let actorAccountId: string | undefined;
  try {
    actorAccountId = await withInstanceScopedDb(instanceId, (client) =>
      resolveActorAccountId(client, { instanceId, keycloakSubject: ctx.user.id })
    );
    if (!actorAccountId && mayProvisionMissingActorMembership) {
      actorAccountId = (
        await withInstanceScopedDb(instanceId, (client) =>
          jitProvisionAccountWithClient(client, {
            instanceId,
            keycloakSubject: ctx.user.id,
            requestId: requestContext.requestId,
            traceId: requestContext.traceId,
          })
        )
      ).accountId;
    }
  } catch (error) {
    logger.error('IAM actor resolution failed during account lookup', {
      operation: 'resolve_actor',
      instance_id: instanceId,
      session_instance_id: ctx.user.instanceId,
      request_id: requestContext.requestId,
      trace_id: requestContext.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      error: createApiError(
        503,
        'database_unavailable',
        'IAM-Datenbank ist nicht erreichbar.',
        requestContext.requestId
      ),
    };
  }

  if (options?.requireActorMembership && !actorAccountId) {
    logger.warn('IAM actor resolution rejected request without actor membership', {
      operation: 'resolve_actor',
      instance_id: instanceId,
      session_instance_id: ctx.user.instanceId,
      allow_jit_provision: mayProvisionMissingActorMembership,
      request_id: requestContext.requestId,
      trace_id: requestContext.traceId,
    });
    return {
      error: createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', requestContext.requestId),
    };
  }

  return {
    actor: {
      instanceId,
      requestId: requestContext.requestId,
      traceId: requestContext.traceId,
      actorAccountId,
    },
  };
};

export const ensureRoleAssignmentWithinActorLevel = async (input: {
  client: QueryClient;
  instanceId: string;
  actorSubject: string;
  actorRoles?: readonly string[];
  roleIds: readonly string[];
}): Promise<{ ok: true; roles: readonly IamRoleRow[] } | { ok: false; code: ApiErrorCode; message: string }> => {
  const roles = await resolveRolesByIds(input.client, {
    instanceId: input.instanceId,
    roleIds: input.roleIds,
  });
  if (roles.length !== input.roleIds.length) {
    return { ok: false, code: 'invalid_request', message: 'Mindestens eine Rolle existiert nicht.' };
  }

  if (input.actorRoles?.includes('system_admin')) {
    return { ok: true, roles };
  }

  const actorMaxRoleLevel = await resolveActorMaxRoleLevel(input.client, {
    instanceId: input.instanceId,
    keycloakSubject: input.actorSubject,
    sessionRoleNames: input.actorRoles,
  });
  if (!canAssignRoles({ actorMaxRoleLevel, targetRoles: roles })) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Rollenzuweisung überschreitet die eigene Berechtigungsstufe.',
    };
  }

  return { ok: true, roles };
};

export const assignRoles = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; roleIds: readonly string[]; assignedBy?: string }
) => {
  await client.query('DELETE FROM iam.account_roles WHERE instance_id = $1 AND account_id = $2::uuid;', [
    input.instanceId,
    input.accountId,
  ]);
  if (input.roleIds.length === 0) {
    return;
  }

  await client.query(
    `
INSERT INTO iam.account_roles (
  instance_id,
  account_id,
  role_id,
  assigned_by,
  valid_from
)
SELECT $1, $2::uuid, role_id, $3::uuid, NOW()
FROM unnest($4::uuid[]) AS role_id;
`,
    [input.instanceId, input.accountId, input.assignedBy ?? null, input.roleIds]
  );
};

export const assignGroups = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId: string;
    groupIds: readonly string[];
    origin?: 'manual' | 'seed' | 'sync';
  }
) => {
  const uniqueGroupIds = [...new Set(input.groupIds)];
  await client.query('DELETE FROM iam.account_groups WHERE instance_id = $1 AND account_id = $2::uuid;', [
    input.instanceId,
    input.accountId,
  ]);
  if (uniqueGroupIds.length === 0) {
    return;
  }

  await client.query(
    `
INSERT INTO iam.account_groups (
  instance_id,
  account_id,
  group_id,
  origin,
  valid_from
)
SELECT $1, $2::uuid, group_id, $3, NOW()
FROM (
  SELECT DISTINCT group_id
  FROM unnest($4::uuid[]) AS input_groups(group_id)
) AS unique_group_ids;
`,
    [input.instanceId, input.accountId, input.origin ?? 'manual', uniqueGroupIds]
  );
};
