import type { ApiErrorResponse, IamUserDetail } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server';
import { jsonResponse } from '../shared/db-helpers';
import { isUuid } from '../shared/input-readers';

import { ADMIN_ROLES } from './constants';
import {
  asApiItem,
  createApiError,
  parseRequestBody,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from './api-helpers';
import { protectField } from './encryption';
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
import { bulkDeactivateSchema, createUserSchema, updateUserSchema } from './schemas';
import { maskEmail, mapRoles } from './user-mapping';
import { resolveUserDetail } from './user-detail-query';

export { getMyProfileInternal, updateMyProfileInternal } from './profile-handlers';
export { getUserInternal, listUsersInternal } from './user-read-handlers';

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
