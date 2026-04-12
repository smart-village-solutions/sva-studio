import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from '../keycloak-admin-client.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { asApiItem, createApiError } from './api-helpers.js';
import { buildRoleSyncFailure } from './role-audit.js';
import { ensureManagedRealmRolesExist } from './shared-managed-role-sync.js';
import { type ActorInfo } from './shared-actor-resolution.js';
import { iamUserOperationsCounter, logger, trackKeycloakCall } from './shared-observability.js';
import { resolveIdentityProvider, withInstanceScopedDb } from './shared-runtime.js';
import {
  compensateUserIdentityUpdate,
} from './user-update-identity.js';
import { createUnexpectedMutationErrorResponse, createUserMutationErrorResponse } from './user-mutation-errors.js';
import { resolveUserUpdatePlan, type UpdateUserPayload, type UserUpdatePlan } from './user-update-plan.js';
import { resolveUpdatedIdentityState, persistUpdatedUserDetail } from './user-update-operation.js';
import { resolveUpdateRequestContext } from './user-update-request-context.js';

const syncUpdatedIdentityAndRoles = async (input: {
  actor: ActorInfo;
  identityProvider: NonNullable<ReturnType<typeof resolveIdentityProvider>>;
  plan: UserUpdatePlan;
  payload: UpdateUserPayload;
  nextIdentityAttributes?: Awaited<ReturnType<typeof resolveUpdatedIdentityState>>['nextIdentityAttributes'];
  shouldRestoreIdentityRef: { current: boolean };
  shouldRestoreRolesRef: { current: boolean };
}) => {
  if (input.nextIdentityAttributes || input.payload.email !== undefined || input.payload.firstName !== undefined || input.payload.lastName !== undefined || input.payload.status !== undefined) {
    await trackKeycloakCall('update_user', () =>
      input.identityProvider.provider.updateUser(input.plan.existing.keycloakSubject, {
        email: input.payload.email,
        firstName: input.payload.firstName,
        lastName: input.payload.lastName,
        enabled: input.payload.status ? input.payload.status !== 'inactive' : undefined,
        attributes: input.nextIdentityAttributes,
      })
    );
    input.shouldRestoreIdentityRef.current = true;
  }

  if (input.plan.nextRoleNames) {
    const nextRoleNames = input.plan.nextRoleNames;
    await ensureManagedRealmRolesExist({
      instanceId: input.actor.instanceId,
      identityProvider: input.identityProvider,
      externalRoleNames: nextRoleNames,
      actorAccountId: input.actor.actorAccountId,
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });
    await trackKeycloakCall('sync_roles', () =>
      input.identityProvider.provider.syncRoles(input.plan.existing.keycloakSubject, [...nextRoleNames])
    );
    input.shouldRestoreRolesRef.current = true;
  }
};

const executeUserUpdate = async (input: {
  actor: ActorInfo;
  ctx: AuthenticatedRequestContext;
  identityProvider: NonNullable<ReturnType<typeof resolveIdentityProvider>>;
  payload: UpdateUserPayload;
  userId: string;
}): Promise<Response> => {
  const plan = await withInstanceScopedDb(input.actor.instanceId, (client) =>
    resolveUserUpdatePlan(client, {
      instanceId: input.actor.instanceId,
      actorSubject: input.ctx.user.id,
      actorRoles: input.ctx.user.roles,
      userId: input.userId,
      payload: input.payload,
    })
  );

  if (!plan) {
    return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', input.actor.requestId);
  }

  const resolvedIdentityState = await resolveUpdatedIdentityState({
    plan,
    payload: input.payload,
    identityProvider: input.identityProvider,
  });

  const shouldRestoreIdentityRef = { current: false };
  const shouldRestoreRolesRef = { current: false };

  try {
    await syncUpdatedIdentityAndRoles({
      actor: input.actor,
      identityProvider: input.identityProvider,
      plan,
      payload: input.payload,
      nextIdentityAttributes: resolvedIdentityState.nextIdentityAttributes,
      shouldRestoreIdentityRef,
      shouldRestoreRolesRef,
    });

    const detail = await persistUpdatedUserDetail({
      instanceId: input.actor.instanceId,
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
      actorAccountId: input.actor.actorAccountId!,
      userId: input.userId,
      keycloakSubject: plan.existing.keycloakSubject,
      payload: input.payload,
      nextMainserverCredentialState: resolvedIdentityState.nextMainserverCredentialState,
    });

    if (!detail) {
      throw new Error('not_found:Nutzer nicht gefunden.');
    }

    iamUserOperationsCounter.add(1, { action: 'update_user', result: 'success' });
    return jsonResponse(200, asApiItem(detail, input.actor.requestId));
  } catch (error) {
    await compensateUserIdentityUpdate({
      instanceId: input.actor.instanceId,
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
      userId: input.userId,
      plan,
      restoreIdentity: shouldRestoreIdentityRef.current,
      restoreRoles: shouldRestoreRolesRef.current,
      restoreIdentityAttributes: resolvedIdentityState.existingIdentityAttributes,
      identityProvider: input.identityProvider,
    });
    throw error;
  }
};

const handleUpdateUserError = (input: {
  error: unknown;
  actor: ActorInfo;
  userId: string;
}): Response => {
  if (input.error instanceof KeycloakAdminRequestError || input.error instanceof KeycloakAdminUnavailableError) {
    return buildRoleSyncFailure({
      error: input.error,
      requestId: input.actor.requestId,
      fallbackMessage: 'Nutzerrollen konnten nicht mit Keycloak synchronisiert werden.',
    });
  }

  const knownError = createUserMutationErrorResponse({
    error: input.error,
    requestId: input.actor.requestId,
    forbiddenFallbackMessage: 'Änderung dieses Nutzers ist nicht erlaubt.',
  });
  if (knownError) {
    return knownError;
  }

  logger.error('IAM user update failed', {
    workspace_id: input.actor.instanceId,
    context: {
      operation: 'update_user',
      instance_id: input.actor.instanceId,
      user_id: input.userId,
      request_id: input.actor.requestId,
      trace_id: input.actor.traceId,
      error: input.error instanceof Error ? input.error.message : String(input.error),
    },
  });
  iamUserOperationsCounter.add(1, { action: 'update_user', result: 'failure' });
  return createUnexpectedMutationErrorResponse({
    requestId: input.actor.requestId,
    message: 'Nutzer konnte nicht aktualisiert werden.',
  });
};

export const updateUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const resolved = await resolveUpdateRequestContext(request, ctx);
  if (resolved instanceof Response) {
    return resolved;
  }

  try {
    return await executeUserUpdate({ ...resolved, ctx });
  } catch (error) {
    return handleUpdateUserError({ error, actor: resolved.actor, userId: resolved.userId });
  }
};
