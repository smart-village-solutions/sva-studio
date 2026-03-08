import type { ApiErrorResponse, IamUserDetail, IamUserRoleAssignment } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';
import type { z } from 'zod';

import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from '../keycloak-admin-client';
import type { AuthenticatedRequestContext } from '../middleware.server';
import type { QueryClient } from '../shared/db-helpers';
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
import { protectField } from './encryption';
import { buildRoleSyncFailure, getRoleExternalName } from './role-audit';
import { bulkDeactivateSchema, updateUserSchema } from './schemas';
import { resolveUsersForBulkDeactivation } from './user-bulk-query';
import { resolveUserDetail } from './user-detail-query';

export { createUserInternal } from './user-create-handler';
export { getMyProfileInternal, updateMyProfileInternal } from './profile-handlers';
export { getUserInternal, listUsersInternal } from './user-read-handlers';

type UpdateUserPayload = z.infer<typeof updateUserSchema>;

type UserUpdatePlan = {
  existing: IamUserDetail;
  previousRoleNames: readonly string[];
  nextRoleNames?: readonly string[];
};

const hasSystemAdminRole = (
  roles: readonly Pick<IamUserRoleAssignment, 'roleKey'>[]
): boolean => roles.some((role) => role.roleKey === 'system_admin');

const resolveExternalRoleNames = async (
  client: QueryClient,
  input: { instanceId: string; roleIds: readonly string[] }
): Promise<readonly string[]> => {
  const roles = await resolveRolesByIds(client, input);
  return roles.map((role) => getRoleExternalName(role));
};

const buildUpdatedUserParams = (
  userId: string,
  instanceId: string,
  keycloakSubject: string,
  payload: {
    email?: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    position?: string;
    department?: string;
    avatarUrl?: string;
    preferredLanguage?: string;
    timezone?: string;
    status?: 'active' | 'inactive' | 'pending';
    notes?: string;
  }
): readonly (string | null)[] => [
  userId,
  instanceId,
  payload.email ? protectField(payload.email, `iam.accounts.email:${keycloakSubject}`) : null,
  payload.displayName ? protectField(payload.displayName, `iam.accounts.display_name:${keycloakSubject}`) : null,
  payload.firstName ? protectField(payload.firstName, `iam.accounts.first_name:${keycloakSubject}`) : null,
  payload.lastName ? protectField(payload.lastName, `iam.accounts.last_name:${keycloakSubject}`) : null,
  payload.phone ? protectField(payload.phone, `iam.accounts.phone:${keycloakSubject}`) : null,
  payload.position ?? null,
  payload.department ?? null,
  payload.avatarUrl ?? null,
  payload.preferredLanguage ?? null,
  payload.timezone ?? null,
  payload.status ?? null,
  payload.notes ?? null,
];

const resolveUserUpdatePlan = async (
  client: QueryClient,
  input: {
    instanceId: string;
    actorSubject: string;
    actorRoles: readonly string[];
    userId: string;
    payload: UpdateUserPayload;
  }
): Promise<UserUpdatePlan | undefined> => {
  const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
    instanceId: input.instanceId,
    keycloakSubject: input.actorSubject,
  });
  const existing = await resolveUserDetail(client, {
    instanceId: input.instanceId,
    userId: input.userId,
  });
  if (!existing) {
    return undefined;
  }

  const targetAccessCheck = ensureActorCanManageTarget({
    actorMaxRoleLevel,
    actorRoles: input.actorRoles,
    targetRoles: existing.roles,
  });
  if (!targetAccessCheck.ok) {
    throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
  }

  const previousRoleNames = await resolveExternalRoleNames(client, {
    instanceId: input.instanceId,
    roleIds: existing.roles.map((role) => role.roleId),
  });

  let nextRoleNames: readonly string[] | undefined;
  if (input.payload.roleIds) {
    const roleValidation = await ensureRoleAssignmentWithinActorLevel({
      client,
      instanceId: input.instanceId,
      actorSubject: input.actorSubject,
      roleIds: input.payload.roleIds,
    });
    if (!roleValidation.ok) {
      throw new Error(`${roleValidation.code}:${roleValidation.message}`);
    }

    const assignedRoles = await resolveRolesByIds(client, {
      instanceId: input.instanceId,
      roleIds: input.payload.roleIds,
    });
    nextRoleNames = assignedRoles.map((role) => getRoleExternalName(role));

    const wouldRemoveSystemAdmin =
      hasSystemAdminRole(existing.roles) &&
      !assignedRoles.some((role) => role.role_key === 'system_admin') &&
      (input.payload.status ?? existing.status) !== 'inactive';

    if (wouldRemoveSystemAdmin) {
      const adminCount = await resolveSystemAdminCount(client, input.instanceId);
      if (adminCount <= 1) {
        throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
      }
    }
  }

  if (
    input.payload.status === 'inactive' &&
    existing.status === 'active' &&
    hasSystemAdminRole(existing.roles)
  ) {
    const adminCount = await resolveSystemAdminCount(client, input.instanceId);
    if (adminCount <= 1) {
      throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
    }
  }

  return {
    existing,
    previousRoleNames,
    nextRoleNames,
  };
};

const compensateUserIdentityUpdate = async (input: {
  instanceId: string;
  requestId?: string;
  traceId?: string;
  userId: string;
  plan: UserUpdatePlan;
  restoreIdentity: boolean;
  restoreRoles: boolean;
  identityProvider: NonNullable<ReturnType<typeof resolveIdentityProvider>>;
}): Promise<void> => {
  const { identityProvider, instanceId, plan, requestId, restoreIdentity, restoreRoles, traceId, userId } = input;

  if (restoreIdentity) {
    try {
      await trackKeycloakCall('update_user_compensation', () =>
        identityProvider.provider.updateUser(plan.existing.keycloakSubject, {
          email: plan.existing.email,
          firstName: plan.existing.firstName,
          lastName: plan.existing.lastName,
          enabled: plan.existing.status !== 'inactive',
        })
      );
    } catch (compensationError) {
      logger.error('IAM user update compensation failed', {
        workspace_id: instanceId,
        context: {
          operation: 'update_user_compensation',
          instance_id: instanceId,
          user_id: userId,
          keycloak_subject: plan.existing.keycloakSubject,
          request_id: requestId,
          trace_id: traceId,
          error: compensationError instanceof Error ? compensationError.message : String(compensationError),
        },
      });
    }
  }

  if (restoreRoles) {
    try {
      await trackKeycloakCall('sync_roles_compensation', () =>
        identityProvider.provider.syncRoles(plan.existing.keycloakSubject, [...plan.previousRoleNames])
      );
    } catch (compensationError) {
      logger.error('IAM user role compensation failed', {
        workspace_id: instanceId,
        context: {
          operation: 'sync_roles_compensation',
          instance_id: instanceId,
          user_id: userId,
          keycloak_subject: plan.existing.keycloakSubject,
          request_id: requestId,
          trace_id: traceId,
          error: compensationError instanceof Error ? compensationError.message : String(compensationError),
        },
      });
    }
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
    const plan = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      resolveUserUpdatePlan(client, {
        instanceId: actorResolution.actor.instanceId,
        actorSubject: ctx.user.id,
        actorRoles: ctx.user.roles,
        userId,
        payload: parsed.data,
      })
    );

    if (!plan) {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', actorResolution.actor.requestId);
    }

    const shouldUpdateIdentity =
      parsed.data.email !== undefined ||
      parsed.data.firstName !== undefined ||
      parsed.data.lastName !== undefined ||
      parsed.data.status !== undefined;
    let shouldRestoreIdentity = false;
    let shouldRestoreRoles = false;

    try {
      if (shouldUpdateIdentity) {
        await trackKeycloakCall('update_user', () =>
          identityProvider.provider.updateUser(plan.existing.keycloakSubject, {
            email: parsed.data.email,
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            enabled: parsed.data.status ? parsed.data.status !== 'inactive' : undefined,
          })
        );
        shouldRestoreIdentity = true;
      }

      if (parsed.data.status === 'inactive') {
        await trackKeycloakCall('deactivate_user', () =>
          identityProvider.provider.deactivateUser(plan.existing.keycloakSubject)
        );
        shouldRestoreIdentity = true;
      }

      if (plan.nextRoleNames) {
        const nextRoleNames = plan.nextRoleNames;
        await trackKeycloakCall('sync_roles', () =>
          identityProvider.provider.syncRoles(plan.existing.keycloakSubject, [...nextRoleNames])
        );
        shouldRestoreRoles = true;
      }

      const detail = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        if (parsed.data.roleIds) {
          await assignRoles(client, {
            instanceId: actorResolution.actor.instanceId,
            accountId: userId,
            roleIds: parsed.data.roleIds,
            assignedBy: actorResolution.actor.actorAccountId,
          });
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
          buildUpdatedUserParams(
            userId,
            actorResolution.actor.instanceId,
            plan.existing.keycloakSubject,
            parsed.data
          )
        );

        await emitActivityLog(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          subjectId: userId,
          eventType: 'user.updated',
          result: 'success',
          payload: {
            status: parsed.data.status ?? plan.existing.status,
            role_update: Boolean(parsed.data.roleIds),
          },
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });

        if (parsed.data.roleIds) {
          await notifyPermissionInvalidation(client, {
            instanceId: actorResolution.actor.instanceId,
            keycloakSubject: plan.existing.keycloakSubject,
            trigger: 'user_role_changed',
          });
        }

        await notifyPermissionInvalidation(client, {
          instanceId: actorResolution.actor.instanceId,
          keycloakSubject: plan.existing.keycloakSubject,
          trigger: 'user_updated',
        });

        return resolveUserDetail(client, {
          instanceId: actorResolution.actor.instanceId,
          userId,
        });
      });

      if (!detail) {
        throw new Error('not_found:Nutzer nicht gefunden.');
      }

      iamUserOperationsCounter.add(1, { action: 'update_user', result: 'success' });
      return jsonResponse(200, asApiItem(detail, actorResolution.actor.requestId));
    } catch (error) {
      await compensateUserIdentityUpdate({
        instanceId: actorResolution.actor.instanceId,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
        userId,
        plan,
        restoreIdentity: shouldRestoreIdentity,
        restoreRoles: shouldRestoreRoles,
        identityProvider,
      });
      throw error;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const [errorCode, errorDetail] = errorMessage.split(':', 2);
    if (error instanceof KeycloakAdminRequestError || error instanceof KeycloakAdminUnavailableError) {
      return buildRoleSyncFailure({
        error,
        requestId: actorResolution.actor.requestId,
        fallbackMessage: 'Nutzerrollen konnten nicht mit Keycloak synchronisiert werden.',
      });
    }
    if (errorCode === 'not_found') {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', actorResolution.actor.requestId);
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
      workspace_id: actorResolution.actor.instanceId,
      context: {
        operation: 'update_user',
        instance_id: actorResolution.actor.instanceId,
        user_id: userId,
        request_id: actorResolution.actor.requestId,
        trace_id: actorResolution.actor.traceId,
        error: errorMessage,
      },
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
      workspace_id: actorResolution.actor.instanceId,
      context: {
        operation: 'deactivate_user',
        instance_id: actorResolution.actor.instanceId,
        user_id: userId,
        request_id: actorResolution.actor.requestId,
        trace_id: actorResolution.actor.traceId,
        error: errorMessage,
      },
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
      const users = await resolveUsersForBulkDeactivation(client, {
        instanceId: actorResolution.actor.instanceId,
        userIds: uniqueUserIds,
      });

      if (users.some((entry) => entry.keycloakSubject === ctx.user.id)) {
        throw new Error('self_protection:Eigener Nutzer kann nicht deaktiviert werden.');
      }

      const targetedActiveAdminCount = users.filter(
        (user) => user.status === 'active' && hasSystemAdminRole(user.roles)
      ).length;
      if (targetedActiveAdminCount > 0) {
        const adminCount = await resolveSystemAdminCount(client, actorResolution.actor.instanceId);
        if (adminCount <= targetedActiveAdminCount) {
          throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
        }
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
      workspace_id: actorResolution.actor.instanceId,
      context: {
        operation: 'bulk_deactivate',
        instance_id: actorResolution.actor.instanceId,
        request_id: actorResolution.actor.requestId,
        trace_id: actorResolution.actor.traceId,
        error: errorMessage,
      },
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
