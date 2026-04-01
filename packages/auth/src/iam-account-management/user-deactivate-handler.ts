import { getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { isUuid } from '../shared/input-readers.js';

import { ADMIN_ROLES } from './constants.js';
import { asApiItem, createApiError, readPathSegment } from './api-helpers.js';
import { validateCsrf } from './csrf.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { ensureActorCanManageTarget, isSystemAdminAccount, resolveActorMaxRoleLevel, resolveSystemAdminCount } from './shared-actor-authorization.js';
import { type ActorInfo, requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { emitActivityLog, notifyPermissionInvalidation } from './shared-activity.js';
import { iamUserOperationsCounter, logger, trackKeycloakCall } from './shared-observability.js';
import { resolveIdentityProvider, withInstanceScopedDb } from './shared-runtime.js';
import { resolveUserDetail } from './user-detail-query.js';
import { createUnexpectedMutationErrorResponse, createUserMutationErrorResponse } from './user-mutation-errors.js';

const resolveDeactivateRequestContext = async (request: Request, ctx: AuthenticatedRequestContext) => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
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

  return { actor: actorResolution.actor, identityProvider, userId };
};

const deactivateUserRecord = async (input: {
  actor: ActorInfo;
  ctx: AuthenticatedRequestContext;
  userId: string;
}) =>
  withInstanceScopedDb(input.actor.instanceId, async (client) => {
    const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: input.ctx.user.id,
      sessionRoleNames: input.ctx.user.roles,
    });
    const existing = await resolveUserDetail(client, {
      instanceId: input.actor.instanceId,
      userId: input.userId,
    });
    if (!existing) {
      return undefined;
    }

    const targetAccessCheck = ensureActorCanManageTarget({
      actorMaxRoleLevel,
      actorRoles: input.ctx.user.roles,
      targetRoles: existing.roles,
    });
    if (!targetAccessCheck.ok) {
      throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
    }

    if (existing.keycloakSubject === input.ctx.user.id) {
      throw new Error('self_protection:Eigener Nutzer kann nicht deaktiviert werden.');
    }

    const isAdmin = await isSystemAdminAccount(client, {
      instanceId: input.actor.instanceId,
      accountId: input.userId,
    });
    if (isAdmin) {
      const adminCount = await resolveSystemAdminCount(client, input.actor.instanceId);
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
  AND instance_id = $2;
`,
      [input.userId, input.actor.instanceId]
    );

    await emitActivityLog(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      subjectId: input.userId,
      eventType: 'user.deactivated',
      result: 'success',
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });

    await notifyPermissionInvalidation(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: existing.keycloakSubject,
      trigger: 'user_deactivated',
    });

    return resolveUserDetail(client, {
      instanceId: input.actor.instanceId,
      userId: input.userId,
    });
  });

export const deactivateUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const resolved = await resolveDeactivateRequestContext(request, ctx);
  if (resolved instanceof Response) {
    return resolved;
  }

  try {
    const detail = await deactivateUserRecord({ actor: resolved.actor, ctx, userId: resolved.userId });

    if (!detail) {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', resolved.actor.requestId);
    }

    await trackKeycloakCall('deactivate_user', () =>
      resolved.identityProvider.provider.deactivateUser(detail.keycloakSubject)
    );

    iamUserOperationsCounter.add(1, { action: 'deactivate_user', result: 'success' });
    return jsonResponse(200, asApiItem(detail, resolved.actor.requestId));
  } catch (error) {
    const knownError = createUserMutationErrorResponse({
      error,
      requestId: resolved.actor.requestId,
      fallbackMessage: 'Nutzer konnte nicht deaktiviert werden.',
      forbiddenFallbackMessage: 'Deaktivierung dieses Nutzers ist nicht erlaubt.',
    });
    if (knownError) {
      return knownError;
    }

    logger.error('IAM deactivate user failed', {
      workspace_id: resolved.actor.instanceId,
      context: {
        operation: 'deactivate_user',
        instance_id: resolved.actor.instanceId,
        user_id: resolved.userId,
        request_id: resolved.actor.requestId,
        trace_id: resolved.actor.traceId,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    iamUserOperationsCounter.add(1, { action: 'deactivate_user', result: 'failure' });
    return createUnexpectedMutationErrorResponse({
      requestId: resolved.actor.requestId,
      message: 'Nutzer konnte nicht deaktiviert werden.',
    });
  }
};
