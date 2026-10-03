import type {
  UpdatedIdentityStateShape,
  UpdateActor,
  UpdateAuthenticatedRequestContext,
  UpdateIdentityProvider,
  UpdateUserHandlerDeps,
  UpdateUserPayloadShape,
  UserUpdatePlanShape,
} from './user-update-contract.js';
import {
  resolveExistingMainserverCredentialState,
  shouldResolveIdentityProvider,
  syncUpdatedIdentityAndRoles,
} from './user-update-identity.js';

export type {
  UpdatedIdentityStateShape,
  UpdateActor,
  UpdateAuthenticatedRequestContext,
  UpdateIdentityAttributes,
  UpdateIdentityProvider,
  UpdateRequestContext,
  UpdateUserHandlerDeps,
  UpdateUserPayloadShape,
  UserUpdatePlanShape,
} from './user-update-contract.js';
export {
  RoleMutationCapabilityUnavailableError,
  shouldUpdateUserIdentityAttributes,
  shouldUpdateUserIdentityPayload,
} from './user-update-identity.js';

const executeUserUpdate = async <
  TPayload extends UpdateUserPayloadShape,
  TPlan extends UserUpdatePlanShape,
  TIdentityState extends UpdatedIdentityStateShape,
  TIdentityProvider extends UpdateIdentityProvider,
>(
  deps: UpdateUserHandlerDeps<TPayload, TPlan, TIdentityState, TIdentityProvider>,
  input: {
    readonly actor: UpdateActor;
    readonly ctx: UpdateAuthenticatedRequestContext;
    readonly identityProvider?: TIdentityProvider;
    readonly payload: TPayload;
    readonly resolveIdentityProvider?: () => Promise<TIdentityProvider | Response>;
    readonly userId: string;
  }
): Promise<Response> => {
  const plan = await deps.withInstanceScopedDb(input.actor.instanceId, (client) =>
    deps.resolveUserUpdatePlan(client, {
      instanceId: input.actor.instanceId,
      actorSubject: input.ctx.user.id,
      actorRoles: input.ctx.user.roles,
      userId: input.userId,
      payload: input.payload,
    })
  );

  if (!plan) {
    return deps.notFoundResponse(input.actor.requestId);
  }

  let identityProvider = input.identityProvider;
  if (!identityProvider && shouldResolveIdentityProvider({ payload: input.payload, plan })) {
    if (!input.resolveIdentityProvider) {
      throw new Error('identity_provider_resolution_unavailable');
    }
    const resolvedIdentityProvider = await input.resolveIdentityProvider();
    if (resolvedIdentityProvider instanceof Response) {
      return resolvedIdentityProvider;
    }
    identityProvider = resolvedIdentityProvider;
  }

  const resolvedIdentityState = await deps.resolveUpdatedIdentityState({
    plan,
    payload: input.payload,
    identityProvider,
  });

  const shouldRestoreIdentityRef = { current: false };
  const shouldRestoreRolesRef = { current: false };

  try {
    if (identityProvider) {
      await syncUpdatedIdentityAndRoles(deps, {
        actor: input.actor,
        identityProvider,
        plan,
        payload: input.payload,
        nextIdentityAttributes: resolvedIdentityState.nextIdentityAttributes,
        shouldRestoreIdentityRef,
        shouldRestoreRolesRef,
      });
    }

    const detail = await deps.persistUpdatedUserDetail({
      instanceId: input.actor.instanceId,
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
      actorAccountId: input.actor.actorAccountId,
      userId: input.userId,
      keycloakSubject: plan.existing.keycloakSubject,
      existingRoleIds: plan.existing.roles?.map((role) => role.roleId),
      existingGroupIds: plan.existing.groups?.map((group) => group.groupId),
      existingIsTechnicalAccount: plan.existing.isTechnicalAccount,
      payload: input.payload,
      existingMainserverCredentialState: resolveExistingMainserverCredentialState(plan.existing),
      nextMainserverCredentialState: resolvedIdentityState.nextMainserverCredentialState,
    });

    if (!detail) {
      throw new Error('not_found:Nutzer nicht gefunden.');
    }

    deps.iamUserOperationsCounter.add(1, { action: 'update_user', result: 'success' });
    return deps.jsonResponse(200, deps.asApiItem(detail, input.actor.requestId));
  } catch (error) {
    await deps.compensateUserIdentityUpdate({
      instanceId: input.actor.instanceId,
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
      userId: input.userId,
      plan,
      restoreIdentity: shouldRestoreIdentityRef.current,
      restoreRoles: shouldRestoreRolesRef.current,
      restoreIdentityAttributes: resolvedIdentityState.existingIdentityAttributes,
      identityProvider,
    });
    throw error;
  }
};

const handleUpdateUserError = <
  TPayload extends UpdateUserPayloadShape,
  TPlan extends UserUpdatePlanShape,
  TIdentityState extends UpdatedIdentityStateShape,
  TIdentityProvider extends UpdateIdentityProvider,
>(
  deps: UpdateUserHandlerDeps<TPayload, TPlan, TIdentityState, TIdentityProvider>,
  input: {
    readonly error: unknown;
    readonly actor: UpdateActor;
    readonly userId: string;
  }
): Response => {
  const keycloakError = deps.handleKeycloakUpdateError({
    error: input.error,
    requestId: input.actor.requestId,
  });
  if (keycloakError) {
    return keycloakError;
  }

  const knownError = deps.createUserMutationErrorResponse({
    error: input.error,
    requestId: input.actor.requestId,
    forbiddenFallbackMessage: 'Änderung dieses Nutzers ist nicht erlaubt.',
  });
  if (knownError) {
    return knownError;
  }

  deps.logger.error('IAM user update failed', {
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
  deps.iamUserOperationsCounter.add(1, { action: 'update_user', result: 'failure' });
  return deps.createUnexpectedMutationErrorResponse({
    requestId: input.actor.requestId,
    message: 'Nutzer konnte nicht aktualisiert werden.',
  });
};

export const createUpdateUserHandlerInternal =
  <
    TPayload extends UpdateUserPayloadShape,
    TPlan extends UserUpdatePlanShape,
    TIdentityState extends UpdatedIdentityStateShape,
    TIdentityProvider extends UpdateIdentityProvider,
  >(
    deps: UpdateUserHandlerDeps<TPayload, TPlan, TIdentityState, TIdentityProvider>
  ) =>
  async (request: Request, ctx: UpdateAuthenticatedRequestContext): Promise<Response> => {
    const resolved = await deps.resolveUpdateRequestContext(request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }

    try {
      return await executeUserUpdate(deps, { ...resolved, ctx });
    } catch (error) {
      return handleUpdateUserError(deps, { error, actor: resolved.actor, userId: resolved.userId });
    }
  };
