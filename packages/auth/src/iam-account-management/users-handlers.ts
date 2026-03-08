import type { ApiErrorCode, ApiErrorResponse, IamUserDetail, IamUserListItem } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import { jitProvisionAccountWithClient } from '../jit-provisioning.server';
import type { AuthenticatedRequestContext } from '../middleware.server';
import { jsonResponse, type QueryClient } from '../shared/db-helpers';
import { isUuid, readString } from '../shared/input-readers';

import { ADMIN_ROLES } from './constants';
import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  readPage,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from './api-helpers';
import { protectField, revealField } from './encryption';
import { ensureFeature, getFeatureFlags } from './feature-flags';
import { consumeRateLimit } from './rate-limit';
import {
  assignRoles,
  completeIdempotency,
  emitActivityLog,
  ensureActorCanManageTarget,
  ensureRoleAssignmentWithinActorLevel,
  iamUserOperationsCounter,
  isSystemAdminAccount,
  logger,
  notifyPermissionInvalidation,
  requireRoles,
  reserveIdempotency,
  resolveActorAccountId,
  resolveActorInfo,
  resolveActorMaxRoleLevel,
  resolveIdentityProvider,
  resolveRolesByIds,
  resolveSystemAdminCount,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared';
import { validateCsrf } from './csrf';
import { getRoleExternalName } from './role-audit';
import {
  bulkDeactivateSchema,
  createUserSchema,
  updateMyProfileSchema,
  updateUserSchema,
} from './schemas';
import type { IamRoleRow, UserStatus } from './types';
import { USER_STATUS } from './types';
import { maskEmail, mapRoles, mapUserRowToListItem } from './user-mapping';

const resolveUsersWithPagination = async (
  client: QueryClient,
  input: {
    instanceId: string;
    page: number;
    pageSize: number;
    status?: UserStatus;
    role?: string;
    search?: string;
  }
): Promise<{ total: number; users: readonly IamUserListItem[] }> => {
  const offset = (input.page - 1) * input.pageSize;
  const totalResult = await client.query<{ total: number }>(
    `
SELECT COUNT(DISTINCT a.id)::int AS total
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1::uuid
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE ($2::text IS NULL OR a.status = $2)
  AND ($3::text IS NULL OR r.role_key = $3)
  AND (
    $4::text IS NULL OR
    a.keycloak_subject ILIKE '%' || $4 || '%' OR
    COALESCE(a.position, '') ILIKE '%' || $4 || '%' OR
    COALESCE(a.department, '') ILIKE '%' || $4 || '%'
  );
`,
    [input.instanceId, input.status ?? null, input.role ?? null, input.search ?? null]
  );

  const rows = await client.query<{
    id: string;
    keycloak_subject: string;
    display_name_ciphertext: string | null;
    first_name_ciphertext: string | null;
    last_name_ciphertext: string | null;
    email_ciphertext: string | null;
    position: string | null;
    department: string | null;
    status: UserStatus;
    last_login_at: string | null;
    role_rows: Array<{
      id: string;
      role_key: string;
      role_name: string;
      display_name: string | null;
      role_level: number;
      is_system_role: boolean;
    }> | null;
  }>(
    `
SELECT
  a.id,
  a.keycloak_subject,
  a.display_name_ciphertext,
  a.first_name_ciphertext,
  a.last_name_ciphertext,
  a.email_ciphertext,
  a.position,
  a.department,
  a.status,
  MAX(al.created_at)::text AS last_login_at,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', r.id,
        'role_key', r.role_key,
        'role_name', r.role_name,
        'display_name', r.display_name,
        'role_level', r.role_level,
        'is_system_role', r.is_system_role
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1::uuid
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
LEFT JOIN iam.role_permissions rp
  ON rp.instance_id = r.instance_id
 AND rp.role_id = r.id
LEFT JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
LEFT JOIN iam.activity_logs al
  ON al.instance_id = im.instance_id
 AND al.account_id = a.id
 AND al.event_type = 'login'
WHERE ($2::text IS NULL OR a.status = $2)
  AND ($3::text IS NULL OR r.role_key = $3)
  AND (
    $4::text IS NULL OR
    a.keycloak_subject ILIKE '%' || $4 || '%' OR
    COALESCE(a.position, '') ILIKE '%' || $4 || '%' OR
    COALESCE(a.department, '') ILIKE '%' || $4 || '%'
  )
GROUP BY a.id
ORDER BY a.created_at DESC
LIMIT $5 OFFSET $6;
`,
    [input.instanceId, input.status ?? null, input.role ?? null, input.search ?? null, input.pageSize, offset]
  );

  const users = rows.rows.map((row) =>
    mapUserRowToListItem({
      ...row,
      roles:
        row.role_rows?.map((entry) => ({
          id: entry.id,
          role_key: entry.role_key,
          role_name: entry.role_name,
          display_name: entry.display_name,
          role_level: Number(entry.role_level),
          is_system_role: Boolean(entry.is_system_role),
        })) ?? [],
    })
  );

  return {
    total: totalResult.rows[0]?.total ?? 0,
    users,
  };
};

const resolveUserDetail = async (
  client: QueryClient,
  input: { instanceId: string; userId: string }
): Promise<IamUserDetail | undefined> => {
  const result = await client.query<{
    id: string;
    keycloak_subject: string;
    display_name_ciphertext: string | null;
    email_ciphertext: string | null;
    first_name_ciphertext: string | null;
    last_name_ciphertext: string | null;
    phone_ciphertext: string | null;
    position: string | null;
    department: string | null;
    preferred_language: string | null;
    timezone: string | null;
    avatar_url: string | null;
    notes: string | null;
    status: UserStatus;
    last_login_at: string | null;
    role_rows: Array<{
      id: string;
      role_key: string;
      role_name: string;
      display_name: string | null;
      role_level: number;
      is_system_role: boolean;
    }> | null;
    permission_rows: Array<{ permission_key: string }> | null;
  }>(
    `
SELECT
  a.id,
  a.keycloak_subject,
  a.display_name_ciphertext,
  a.email_ciphertext,
  a.first_name_ciphertext,
  a.last_name_ciphertext,
  a.phone_ciphertext,
  a.position,
  a.department,
  a.preferred_language,
  a.timezone,
  a.avatar_url,
  a.notes,
  a.status,
  MAX(al.created_at)::text AS last_login_at,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', r.id,
        'role_key', r.role_key,
        'role_name', r.role_name,
        'display_name', r.display_name,
        'role_level', r.role_level,
        'is_system_role', r.is_system_role
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'permission_key', p.permission_key
      )
    ) FILTER (WHERE p.permission_key IS NOT NULL),
    '[]'::json
  ) AS permission_rows
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1::uuid
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
LEFT JOIN iam.role_permissions rp
  ON rp.instance_id = r.instance_id
 AND rp.role_id = r.id
LEFT JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
LEFT JOIN iam.activity_logs al
  ON al.instance_id = im.instance_id
 AND al.account_id = a.id
 AND al.event_type = 'login'
WHERE a.id = $2::uuid
GROUP BY a.id;
`,
    [input.instanceId, input.userId]
  );

  const row = result.rows[0];
  if (!row) {
    return undefined;
  }

  const base = mapUserRowToListItem({
    id: row.id,
    keycloak_subject: row.keycloak_subject,
    display_name_ciphertext: row.display_name_ciphertext,
    first_name_ciphertext: row.first_name_ciphertext,
    last_name_ciphertext: row.last_name_ciphertext,
    email_ciphertext: row.email_ciphertext,
    position: row.position,
    department: row.department,
    status: row.status,
    last_login_at: row.last_login_at,
    roles:
      row.role_rows?.map((entry) => ({
        id: entry.id,
        role_key: entry.role_key,
        role_name: entry.role_name,
        display_name: entry.display_name,
        role_level: Number(entry.role_level),
        is_system_role: Boolean(entry.is_system_role),
      })) ?? [],
  });

  return {
    ...base,
    firstName: revealField(row.first_name_ciphertext, `iam.accounts.first_name:${row.keycloak_subject}`),
    lastName: revealField(row.last_name_ciphertext, `iam.accounts.last_name:${row.keycloak_subject}`),
    phone: revealField(row.phone_ciphertext, `iam.accounts.phone:${row.keycloak_subject}`),
    preferredLanguage: row.preferred_language ?? undefined,
    timezone: row.timezone ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    notes: row.notes ?? undefined,
    permissions: row.permission_rows?.map((entry) => entry.permission_key) ?? [],
  };
};

export const listUsersInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const { page, pageSize } = readPage(request);
  const url = new URL(request.url);
  const status = readString(url.searchParams.get('status')) as UserStatus | undefined;
  const role = readString(url.searchParams.get('role'));
  const search = readString(url.searchParams.get('search'));

  if (status && !USER_STATUS.includes(status)) {
    return createApiError(400, 'invalid_request', 'Ungültiger Status-Filter.', actorResolution.actor.requestId);
  }

  try {
    const data = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      resolveUsersWithPagination(client, {
        instanceId: actorResolution.actor.instanceId,
        page,
        pageSize,
        status,
        role: role ?? undefined,
        search: search ?? undefined,
      })
    );

    return jsonResponse(
      200,
      asApiList(data.users, { page, pageSize, total: data.total }, actorResolution.actor.requestId)
    );
  } catch (error) {
    logger.error('IAM user list failed', {
      operation: 'list_users',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'IAM-Datenbank ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
  }
};

export const getUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const userId = readPathSegment(request, 4);
  if (!userId || !isUuid(userId)) {
    return createApiError(400, 'invalid_request', 'Ungültige userId.', actorResolution.actor.requestId);
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const user = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      resolveUserDetail(client, { instanceId: actorResolution.actor.instanceId, userId })
    );
    if (!user) {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', actorResolution.actor.requestId);
    }
    return jsonResponse(200, asApiItem(user, actorResolution.actor.requestId));
  } catch {
    return createApiError(
      503,
      'database_unavailable',
      'IAM-Datenbank ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
  }
};

export const createUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const idempotencyKey = requireIdempotencyKey(request, actorResolution.actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, createUserSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const payloadHash = toPayloadHash(parsed.rawBody);
  const reserve = await reserveIdempotency({
    instanceId: actorResolution.actor.instanceId,
    actorAccountId: actorResolution.actor.actorAccountId,
    endpoint: 'POST:/api/v1/iam/users',
    idempotencyKey: idempotencyKey.key,
    payloadHash,
  });

  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actorResolution.actor.requestId);
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    const response = {
      error: {
        code: 'keycloak_unavailable',
        message: 'Keycloak Admin API ist nicht konfiguriert.',
      },
      ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
    } satisfies ApiErrorResponse;
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/users',
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: 503,
      responseBody: response,
    });
    return jsonResponse(503, response);
  }

  let createdExternalId: string | undefined;
  try {
    const createdIdentityUser = await trackKeycloakCall('create_user', () =>
      identityProvider.provider.createUser({
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        enabled: parsed.data.status !== 'inactive',
      })
    );
    const externalId = createdIdentityUser.externalId;
    createdExternalId = externalId;

    const result = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const roleValidation = await ensureRoleAssignmentWithinActorLevel({
        client,
        instanceId: actorResolution.actor.instanceId,
        actorSubject: ctx.user.id,
        roleIds: parsed.data.roleIds,
      });
      if (!roleValidation.ok) {
        throw new Error(`${roleValidation.code}:${roleValidation.message}`);
      }

      const inserted = await client.query<{ id: string }>(
        `
INSERT INTO iam.accounts (
  instance_id,
  keycloak_subject,
  email_ciphertext,
  display_name_ciphertext,
  first_name_ciphertext,
  last_name_ciphertext,
  phone_ciphertext,
  position,
  department,
  avatar_url,
  preferred_language,
  timezone,
  status,
  notes
)
VALUES (
  $1::uuid,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8,
  $9,
  $10,
  $11,
  $12,
  $13,
  $14
)
RETURNING id;
`,
        [
          actorResolution.actor.instanceId,
          externalId,
          protectField(parsed.data.email, `iam.accounts.email:${externalId}`),
          protectField(
            parsed.data.displayName ?? [parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(' '),
            `iam.accounts.display_name:${externalId}`
          ),
          protectField(parsed.data.firstName, `iam.accounts.first_name:${externalId}`),
          protectField(parsed.data.lastName, `iam.accounts.last_name:${externalId}`),
          protectField(parsed.data.phone, `iam.accounts.phone:${externalId}`),
          parsed.data.position ?? null,
          parsed.data.department ?? null,
          parsed.data.avatarUrl ?? null,
          parsed.data.preferredLanguage ?? null,
          parsed.data.timezone ?? null,
          parsed.data.status ?? 'pending',
          parsed.data.notes ?? null,
        ]
      );

      const accountId = inserted.rows[0]?.id;
      if (!accountId) {
        throw new Error('conflict:Account konnte nicht erstellt werden.');
      }

      await client.query(
        `
INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
VALUES ($1::uuid, $2::uuid, 'member')
ON CONFLICT (instance_id, account_id) DO NOTHING;
`,
        [actorResolution.actor.instanceId, accountId]
      );

      await assignRoles(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId,
        roleIds: parsed.data.roleIds,
        assignedBy: actorResolution.actor.actorAccountId,
      });

      const assignedRoleRows = await resolveRolesByIds(client, {
        instanceId: actorResolution.actor.instanceId,
        roleIds: parsed.data.roleIds,
      });

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        subjectId: accountId,
        eventType: 'user.created',
        result: 'success',
        payload: {
          target_keycloak_subject: externalId,
          role_count: parsed.data.roleIds.length,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: externalId,
        trigger: 'user_role_changed',
      });

      const responseData: IamUserDetail = {
        id: accountId,
        keycloakSubject: externalId,
        displayName:
          parsed.data.displayName ??
          ([parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(' ') || externalId),
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        position: parsed.data.position,
        department: parsed.data.department,
        preferredLanguage: parsed.data.preferredLanguage,
        timezone: parsed.data.timezone,
        avatarUrl: parsed.data.avatarUrl,
        notes: parsed.data.notes,
        status: parsed.data.status ?? 'pending',
        roles: mapRoles(assignedRoleRows),
      };

      return {
        responseData,
        roleNames: assignedRoleRows.map((entry) => getRoleExternalName(entry)),
      };
    });

    if (result.roleNames.length > 0) {
      await trackKeycloakCall('sync_roles', () =>
        identityProvider.provider.syncRoles(result.responseData.keycloakSubject, result.roleNames)
      );
    }

    iamUserOperationsCounter.add(1, { action: 'create_user', result: 'success' });
    const responseBody = asApiItem(result.responseData, actorResolution.actor.requestId);
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/users',
      idempotencyKey: idempotencyKey.key,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody,
    });
    return jsonResponse(201, responseBody);
  } catch (error) {
    logger.error('IAM user creation failed', {
      operation: 'create_user',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      actor_account_id: actorResolution.actor.actorAccountId,
      email_masked: maskEmail(parsed.data.email),
      error: error instanceof Error ? error.message : String(error),
    });

    if (createdExternalId) {
      try {
        const fallbackIdentityProvider = resolveIdentityProvider();
        if (fallbackIdentityProvider) {
          const compensatedExternalId = createdExternalId;
          await trackKeycloakCall('deactivate_user_compensation', () =>
            fallbackIdentityProvider.provider.deactivateUser(compensatedExternalId)
          );
        }
      } catch (compensationError) {
        logger.error('IAM user create compensation failed', {
          operation: 'create_user_compensation',
          keycloak_subject: createdExternalId,
          request_id: actorResolution.actor.requestId,
          trace_id: actorResolution.actor.traceId,
          error: compensationError instanceof Error ? compensationError.message : String(compensationError),
        });
      }
    }

    iamUserOperationsCounter.add(1, { action: 'create_user', result: 'failure' });

    const errorBody = {
      error: {
        code: 'internal_error',
        message: 'Nutzer konnte nicht erstellt werden.',
      },
      ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
    } satisfies ApiErrorResponse;

    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/users',
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: 500,
      responseBody: errorBody,
    });
    return jsonResponse(500, errorBody);
  }
};

export const updateUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const userId = readPathSegment(request, 4);
  if (!userId || !isUuid(userId)) {
    return createApiError(400, 'invalid_request', 'Ungültige userId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const parsed = await parseRequestBody(request, updateUserSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      actorResolution.actor.requestId
    );
  }

  try {
    const result = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: ctx.user.id,
      });
      const existing = await resolveUserDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        userId,
      });
      if (!existing) {
        return undefined;
      }

      const targetAccessCheck = ensureActorCanManageTarget({
        actorMaxRoleLevel,
        actorRoles: ctx.user.roles,
        targetRoles: existing.roles,
      });
      if (!targetAccessCheck.ok) {
        throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
      }

      let syncedRoleNames: readonly string[] | undefined;
      if (parsed.data.roleIds) {
        const roleValidation = await ensureRoleAssignmentWithinActorLevel({
          client,
          instanceId: actorResolution.actor.instanceId,
          actorSubject: ctx.user.id,
          roleIds: parsed.data.roleIds,
        });
        if (!roleValidation.ok) {
          throw new Error(`${roleValidation.code}:${roleValidation.message}`);
        }

        await assignRoles(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: userId,
          roleIds: parsed.data.roleIds,
          assignedBy: actorResolution.actor.actorAccountId,
        });
        const assignedRoles = await resolveRolesByIds(client, {
          instanceId: actorResolution.actor.instanceId,
          roleIds: parsed.data.roleIds,
        });
        syncedRoleNames = assignedRoles.map((role) => getRoleExternalName(role));

        await notifyPermissionInvalidation(client, {
          instanceId: actorResolution.actor.instanceId,
          keycloakSubject: existing.keycloakSubject,
          trigger: 'user_role_changed',
        });
      }

      if (parsed.data.status === 'inactive') {
        const lastAdmin = await isSystemAdminAccount(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: userId,
        });
        if (lastAdmin) {
          const adminCount = await resolveSystemAdminCount(client, actorResolution.actor.instanceId);
          if (adminCount <= 1) {
            throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
          }
        }
      }

      await client.query(
        `
UPDATE iam.accounts
SET
  email_ciphertext = COALESCE($3, email_ciphertext),
  display_name_ciphertext = COALESCE($4, display_name_ciphertext),
  first_name_ciphertext = COALESCE($5, first_name_ciphertext),
  last_name_ciphertext = COALESCE($6, last_name_ciphertext),
  phone_ciphertext = COALESCE($7, phone_ciphertext),
  position = COALESCE($8, position),
  department = COALESCE($9, department),
  avatar_url = COALESCE($10, avatar_url),
  preferred_language = COALESCE($11, preferred_language),
  timezone = COALESCE($12, timezone),
  status = COALESCE($13, status),
  notes = COALESCE($14, notes),
  updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2::uuid;
`,
        [
          userId,
          actorResolution.actor.instanceId,
          parsed.data.email
            ? protectField(parsed.data.email, `iam.accounts.email:${existing.keycloakSubject}`)
            : null,
          parsed.data.displayName
            ? protectField(parsed.data.displayName, `iam.accounts.display_name:${existing.keycloakSubject}`)
            : null,
          parsed.data.firstName
            ? protectField(parsed.data.firstName, `iam.accounts.first_name:${existing.keycloakSubject}`)
            : null,
          parsed.data.lastName
            ? protectField(parsed.data.lastName, `iam.accounts.last_name:${existing.keycloakSubject}`)
            : null,
          parsed.data.phone
            ? protectField(parsed.data.phone, `iam.accounts.phone:${existing.keycloakSubject}`)
            : null,
          parsed.data.position ?? null,
          parsed.data.department ?? null,
          parsed.data.avatarUrl ?? null,
          parsed.data.preferredLanguage ?? null,
          parsed.data.timezone ?? null,
          parsed.data.status ?? null,
          parsed.data.notes ?? null,
        ]
      );

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        subjectId: userId,
        eventType: 'user.updated',
        result: 'success',
        payload: {
          status: parsed.data.status ?? existing.status,
          role_update: Boolean(parsed.data.roleIds),
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: existing.keycloakSubject,
        trigger: 'user_updated',
      });

      return {
        detail: await resolveUserDetail(client, {
          instanceId: actorResolution.actor.instanceId,
          userId,
        }),
        roleNames: syncedRoleNames,
      };
    });

    if (!result?.detail) {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', actorResolution.actor.requestId);
    }
    const detail = result.detail;
    const roleNames = result.roleNames;

    await trackKeycloakCall('update_user', () =>
      identityProvider.provider.updateUser(detail.keycloakSubject, {
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        enabled: parsed.data.status ? parsed.data.status !== 'inactive' : undefined,
      })
    );

    if (parsed.data.status === 'inactive') {
      await trackKeycloakCall('deactivate_user', () =>
        identityProvider.provider.deactivateUser(detail.keycloakSubject)
      );
    }

    if (roleNames) {
      await trackKeycloakCall('sync_roles', () =>
        identityProvider.provider.syncRoles(detail.keycloakSubject, [...roleNames])
      );
    }

    iamUserOperationsCounter.add(1, { action: 'update_user', result: 'success' });
    return jsonResponse(200, asApiItem(detail, actorResolution.actor.requestId));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const [errorCode, errorDetail] = errorMessage.split(':', 2);
    if (errorCode === 'last_admin_protection') {
      return createApiError(
        409,
        'last_admin_protection',
        'Letzter aktiver system_admin kann nicht deaktiviert werden.',
        actorResolution.actor.requestId
      );
    }
    if (errorCode === 'forbidden') {
      return createApiError(
        403,
        'forbidden',
        errorDetail ?? 'Änderung dieses Nutzers ist nicht erlaubt.',
        actorResolution.actor.requestId
      );
    }
    if (errorCode === 'invalid_request') {
      return createApiError(400, 'invalid_request', 'Ungültige Rolle.', actorResolution.actor.requestId);
    }
    if (errorCode === 'pii_encryption_required') {
      return createApiError(
        503,
        'internal_error',
        'PII-Verschlüsselung ist nicht konfiguriert.',
        actorResolution.actor.requestId
      );
    }

    logger.error('IAM user update failed', {
      operation: 'update_user',
      instance_id: actorResolution.actor.instanceId,
      user_id: userId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: errorMessage,
    });
    iamUserOperationsCounter.add(1, { action: 'update_user', result: 'failure' });
    return createApiError(
      500,
      'internal_error',
      'Nutzer konnte nicht aktualisiert werden.',
      actorResolution.actor.requestId
    );
  }
};

export const deactivateUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const userId = readPathSegment(request, 4);
  if (!userId || !isUuid(userId)) {
    return createApiError(400, 'invalid_request', 'Ungültige userId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      actorResolution.actor.requestId
    );
  }

  try {
    const detail = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: ctx.user.id,
      });
      const existing = await resolveUserDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        userId,
      });
      if (!existing) {
        return undefined;
      }

      const targetAccessCheck = ensureActorCanManageTarget({
        actorMaxRoleLevel,
        actorRoles: ctx.user.roles,
        targetRoles: existing.roles,
      });
      if (!targetAccessCheck.ok) {
        throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
      }

      if (existing.keycloakSubject === ctx.user.id) {
        throw new Error('self_protection:Eigener Nutzer kann nicht deaktiviert werden.');
      }

      const isAdmin = await isSystemAdminAccount(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: userId,
      });
      if (isAdmin) {
        const adminCount = await resolveSystemAdminCount(client, actorResolution.actor.instanceId);
        if (adminCount <= 1) {
          throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
        }
      }

      await client.query(
        `
UPDATE iam.accounts
SET
  status = 'inactive',
  updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2::uuid;
`,
        [userId, actorResolution.actor.instanceId]
      );

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        subjectId: userId,
        eventType: 'user.deactivated',
        result: 'success',
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: existing.keycloakSubject,
        trigger: 'user_deactivated',
      });

      return resolveUserDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        userId,
      });
    });

    if (!detail) {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', actorResolution.actor.requestId);
    }

    await trackKeycloakCall('deactivate_user', () =>
      identityProvider.provider.deactivateUser(detail.keycloakSubject)
    );

    iamUserOperationsCounter.add(1, { action: 'deactivate_user', result: 'success' });
    return jsonResponse(200, asApiItem(detail, actorResolution.actor.requestId));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const [errorCode, errorDetail] = errorMessage.split(':', 2);
    if (errorCode === 'self_protection') {
      return createApiError(
        409,
        'self_protection',
        'Eigener Nutzer kann nicht deaktiviert werden.',
        actorResolution.actor.requestId
      );
    }
    if (errorCode === 'last_admin_protection') {
      return createApiError(
        409,
        'last_admin_protection',
        'Letzter aktiver system_admin kann nicht deaktiviert werden.',
        actorResolution.actor.requestId
      );
    }
    if (errorCode === 'forbidden') {
      return createApiError(
        403,
        'forbidden',
        errorDetail ?? 'Deaktivierung dieses Nutzers ist nicht erlaubt.',
        actorResolution.actor.requestId
      );
    }

    logger.error('IAM deactivate user failed', {
      operation: 'deactivate_user',
      instance_id: actorResolution.actor.instanceId,
      user_id: userId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: errorMessage,
    });
    iamUserOperationsCounter.add(1, { action: 'deactivate_user', result: 'failure' });
    return createApiError(
      500,
      'internal_error',
      'Nutzer konnte nicht deaktiviert werden.',
      actorResolution.actor.requestId
    );
  }
};

export const bulkDeactivateInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_bulk', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'bulk',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const idempotencyKey = requireIdempotencyKey(request, actorResolution.actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, bulkDeactivateSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const payloadHash = toPayloadHash(parsed.rawBody);
  const reserve = await reserveIdempotency({
    instanceId: actorResolution.actor.instanceId,
    actorAccountId: actorResolution.actor.actorAccountId,
    endpoint: 'POST:/api/v1/iam/users/bulk-deactivate',
    idempotencyKey: idempotencyKey.key,
    payloadHash,
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actorResolution.actor.requestId);
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      actorResolution.actor.requestId
    );
  }

  try {
    const uniqueUserIds = [...new Set(parsed.data.userIds)];
    const details = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: ctx.user.id,
      });
      const users = (
        await Promise.all(
          uniqueUserIds.map((userId) =>
            resolveUserDetail(client, {
              instanceId: actorResolution.actor.instanceId,
              userId,
            })
          )
        )
      ).filter((entry): entry is IamUserDetail => Boolean(entry));

      if (users.some((entry) => entry.keycloakSubject === ctx.user.id)) {
        throw new Error('self_protection:Eigener Nutzer kann nicht deaktiviert werden.');
      }

      for (const user of users) {
        const targetAccessCheck = ensureActorCanManageTarget({
          actorMaxRoleLevel,
          actorRoles: ctx.user.roles,
          targetRoles: user.roles,
        });
        if (!targetAccessCheck.ok) {
          throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
        }

        const isAdmin = await isSystemAdminAccount(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: user.id,
        });
        if (isAdmin) {
          const adminCount = await resolveSystemAdminCount(client, actorResolution.actor.instanceId);
          if (adminCount <= 1) {
            throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
          }
        }
      }

      await client.query(
        `
UPDATE iam.accounts
SET
  status = 'inactive',
  updated_at = NOW()
WHERE instance_id = $1::uuid
  AND id = ANY($2::uuid[]);
`,
        [actorResolution.actor.instanceId, uniqueUserIds]
      );

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        eventType: 'user.bulk_deactivated',
        result: 'success',
        payload: {
          total: users.length,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      for (const user of users) {
        await notifyPermissionInvalidation(client, {
          instanceId: actorResolution.actor.instanceId,
          keycloakSubject: user.keycloakSubject,
          trigger: 'user_bulk_deactivated',
        });
      }

      return users;
    });

    await Promise.all(
      details.map((detail) =>
        trackKeycloakCall('deactivate_user_bulk', () =>
          identityProvider.provider.deactivateUser(detail.keycloakSubject)
        )
      )
    );
    iamUserOperationsCounter.add(1, { action: 'bulk_deactivate', result: 'success' });

    const responseBody = asApiItem(
      {
        deactivatedUserIds: details.map((entry) => entry.id),
        count: details.length,
      },
      actorResolution.actor.requestId
    );
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/users/bulk-deactivate',
      idempotencyKey: idempotencyKey.key,
      status: 'COMPLETED',
      responseStatus: 200,
      responseBody,
    });
    return jsonResponse(200, responseBody);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const [errorCode, errorDetail] = errorMessage.split(':', 2);
    if (errorCode === 'self_protection') {
      return createApiError(
        409,
        'self_protection',
        'Eigener Nutzer kann nicht deaktiviert werden.',
        actorResolution.actor.requestId
      );
    }
    if (errorCode === 'last_admin_protection') {
      return createApiError(
        409,
        'last_admin_protection',
        'Letzter aktiver system_admin kann nicht deaktiviert werden.',
        actorResolution.actor.requestId
      );
    }
    if (errorCode === 'forbidden') {
      return createApiError(
        403,
        'forbidden',
        errorDetail ?? 'Bulk-Deaktivierung enthält nicht erlaubte Zielnutzer.',
        actorResolution.actor.requestId
      );
    }

    logger.error('IAM bulk deactivate failed', {
      operation: 'bulk_deactivate',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: errorMessage,
    });
    iamUserOperationsCounter.add(1, { action: 'bulk_deactivate', result: 'failure' });
    const errorBody = {
      error: {
        code: 'internal_error',
        message: 'Bulk-Deaktivierung fehlgeschlagen.',
      },
      ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
    } satisfies ApiErrorResponse;
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/users/bulk-deactivate',
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: 500,
      responseBody: errorBody,
    });
    return jsonResponse(500, errorBody);
  }
};

export const updateMyProfileInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_ui', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, {
    createMissingInstanceFromKey: process.env.NODE_ENV !== 'production',
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const parsed = await parseRequestBody(request, updateMyProfileSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  try {
    const detail = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const existingAccountId = await resolveActorAccountId(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: ctx.user.id,
      });
      const accountId =
        existingAccountId ??
        (
          await jitProvisionAccountWithClient(client, {
            instanceId: actorResolution.actor.instanceId,
            keycloakSubject: ctx.user.id,
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          })
        ).accountId;

      await client.query(
        `
UPDATE iam.accounts
SET
  first_name_ciphertext = COALESCE($3, first_name_ciphertext),
  last_name_ciphertext = COALESCE($4, last_name_ciphertext),
  display_name_ciphertext = COALESCE($5, display_name_ciphertext),
  phone_ciphertext = COALESCE($6, phone_ciphertext),
  position = COALESCE($7, position),
  department = COALESCE($8, department),
  preferred_language = COALESCE($9, preferred_language),
  timezone = COALESCE($10, timezone),
  updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2::uuid;
`,
        [
          accountId,
          actorResolution.actor.instanceId,
          parsed.data.firstName ? protectField(parsed.data.firstName, `iam.accounts.first_name:${ctx.user.id}`) : null,
          parsed.data.lastName ? protectField(parsed.data.lastName, `iam.accounts.last_name:${ctx.user.id}`) : null,
          parsed.data.displayName
            ? protectField(parsed.data.displayName, `iam.accounts.display_name:${ctx.user.id}`)
            : null,
          parsed.data.phone ? protectField(parsed.data.phone, `iam.accounts.phone:${ctx.user.id}`) : null,
          parsed.data.position ?? null,
          parsed.data.department ?? null,
          parsed.data.preferredLanguage ?? null,
          parsed.data.timezone ?? null,
        ]
      );

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId,
        subjectId: accountId,
        eventType: 'user.profile_updated',
        result: 'success',
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      return resolveUserDetail(client, { instanceId: actorResolution.actor.instanceId, userId: accountId });
    });

    if (!detail) {
      return createApiError(404, 'not_found', 'Nutzerprofil nicht gefunden.', actorResolution.actor.requestId);
    }

    iamUserOperationsCounter.add(1, { action: 'update_my_profile', result: 'success' });
    return jsonResponse(200, asApiItem(detail, actorResolution.actor.requestId));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const [errorCode] = errorMessage.split(':', 2);
    if (errorCode === 'pii_encryption_required') {
      return createApiError(
        503,
        'internal_error',
        'PII-Verschlüsselung ist nicht konfiguriert.',
        actorResolution.actor.requestId
      );
    }
    logger.error('IAM profile update failed', {
      operation: 'update_my_profile',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: errorMessage,
    });
    iamUserOperationsCounter.add(1, { action: 'update_my_profile', result: 'failure' });
    return createApiError(
      500,
      'internal_error',
      'Profil konnte nicht aktualisiert werden.',
      actorResolution.actor.requestId
    );
  }
};

export const getMyProfileInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_ui', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, {
    createMissingInstanceFromKey: process.env.NODE_ENV !== 'production',
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const detail = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const existingAccountId = await resolveActorAccountId(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: ctx.user.id,
      });
      const accountId =
        existingAccountId ??
        (
          await jitProvisionAccountWithClient(client, {
            instanceId: actorResolution.actor.instanceId,
            keycloakSubject: ctx.user.id,
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          })
        ).accountId;
      return resolveUserDetail(client, { instanceId: actorResolution.actor.instanceId, userId: accountId });
    });

    if (!detail) {
      return createApiError(404, 'not_found', 'Nutzerprofil nicht gefunden.', actorResolution.actor.requestId);
    }

    iamUserOperationsCounter.add(1, { action: 'get_my_profile', result: 'success' });
    return jsonResponse(200, asApiItem(detail, actorResolution.actor.requestId));
  } catch (error) {
    logger.error('IAM profile fetch failed', {
      operation: 'get_my_profile',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    iamUserOperationsCounter.add(1, { action: 'get_my_profile', result: 'failure' });
    return createApiError(
      500,
      'internal_error',
      'Profil konnte nicht geladen werden.',
      actorResolution.actor.requestId
    );
  }
};
