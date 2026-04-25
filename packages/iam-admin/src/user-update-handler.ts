import type { QueryClient } from './query-client.js';

export type UpdateAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type UpdateActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type UpdateIdentityAttributes = Readonly<Record<string, string | readonly string[]>>;

export type UpdateIdentityProvider = {
  readonly provider: {
    readonly updateUser: (
      keycloakSubject: string,
      input: {
        readonly email?: string;
        readonly firstName?: string;
        readonly lastName?: string;
        readonly enabled?: boolean;
        readonly attributes?: UpdateIdentityAttributes;
      }
    ) => Promise<void>;
    readonly syncRoles: (keycloakSubject: string, roleNames: string[]) => Promise<void>;
  };
};

export type UpdateUserPayloadShape = {
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly status?: 'active' | 'inactive' | 'pending';
};

export type UserUpdatePlanShape = {
  readonly existing: {
    readonly keycloakSubject: string;
  };
  readonly previousRoleNames: readonly string[];
  readonly nextRoleNames?: readonly string[];
};

export type UpdatedIdentityStateShape = {
  readonly existingIdentityAttributes?: UpdateIdentityAttributes;
  readonly nextIdentityAttributes?: UpdateIdentityAttributes;
  readonly nextMainserverCredentialState?: unknown;
};

export type UpdateRequestContext<
  TPayload extends UpdateUserPayloadShape,
  TIdentityProvider extends UpdateIdentityProvider = UpdateIdentityProvider,
> =
  | Response
  | {
      readonly actor: UpdateActor;
      readonly identityProvider: TIdentityProvider;
      readonly payload: TPayload;
      readonly userId: string;
    };

export type UpdateUserHandlerDeps<
  TPayload extends UpdateUserPayloadShape = UpdateUserPayloadShape,
  TPlan extends UserUpdatePlanShape = UserUpdatePlanShape,
  TIdentityState extends UpdatedIdentityStateShape = UpdatedIdentityStateShape,
  TIdentityProvider extends UpdateIdentityProvider = UpdateIdentityProvider,
> = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly createUnexpectedMutationErrorResponse: (input: {
    readonly requestId?: string;
    readonly message: string;
  }) => Response;
  readonly createUserMutationErrorResponse: (input: {
    readonly error: unknown;
    readonly requestId?: string;
    readonly forbiddenFallbackMessage: string;
  }) => Response | null;
  readonly ensureManagedRealmRolesExist: (input: {
    readonly instanceId: string;
    readonly identityProvider: TIdentityProvider;
    readonly externalRoleNames: readonly string[];
    readonly actorAccountId?: string;
    readonly requestId?: string;
    readonly traceId?: string;
  }) => Promise<void>;
  readonly handleKeycloakUpdateError: (input: {
    readonly error: unknown;
    readonly requestId?: string;
  }) => Response | null;
  readonly iamUserOperationsCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly notFoundResponse: (requestId?: string) => Response;
  readonly persistUpdatedUserDetail: (input: {
    readonly instanceId: string;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly actorAccountId: string;
    readonly userId: string;
    readonly keycloakSubject: string;
    readonly payload: TPayload;
    readonly nextMainserverCredentialState: TIdentityState['nextMainserverCredentialState'];
  }) => Promise<unknown | undefined>;
  readonly compensateUserIdentityUpdate: (input: {
    readonly instanceId: string;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly userId: string;
    readonly plan: TPlan;
    readonly restoreIdentity: boolean;
    readonly restoreRoles: boolean;
    readonly restoreIdentityAttributes?: TIdentityState['existingIdentityAttributes'];
    readonly identityProvider: TIdentityProvider;
  }) => Promise<void>;
  readonly resolveUpdateRequestContext: (
    request: Request,
    ctx: UpdateAuthenticatedRequestContext
  ) => Promise<UpdateRequestContext<TPayload, TIdentityProvider>>;
  readonly resolveUpdatedIdentityState: (input: {
    readonly plan: TPlan;
    readonly payload: TPayload;
    readonly identityProvider: TIdentityProvider;
  }) => Promise<TIdentityState>;
  readonly resolveUserUpdatePlan: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly actorSubject: string;
      readonly actorRoles: readonly string[];
      readonly userId: string;
      readonly payload: TPayload;
    }
  ) => Promise<TPlan | undefined>;
  readonly trackKeycloakCall: <T>(
    operation: 'update_user' | 'sync_roles',
    work: () => Promise<T>
  ) => Promise<T>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

const syncUpdatedIdentityAndRoles = async <
  TPayload extends UpdateUserPayloadShape,
  TPlan extends UserUpdatePlanShape,
  TIdentityState extends UpdatedIdentityStateShape,
  TIdentityProvider extends UpdateIdentityProvider,
>(
  deps: UpdateUserHandlerDeps<TPayload, TPlan, TIdentityState, TIdentityProvider>,
  input: {
    readonly actor: UpdateActor;
    readonly identityProvider: TIdentityProvider;
    readonly plan: TPlan;
    readonly payload: TPayload;
    readonly nextIdentityAttributes?: TIdentityState['nextIdentityAttributes'];
    readonly shouldRestoreIdentityRef: { current: boolean };
    readonly shouldRestoreRolesRef: { current: boolean };
  }
) => {
  if (
    input.nextIdentityAttributes ||
    input.payload.email !== undefined ||
    input.payload.firstName !== undefined ||
    input.payload.lastName !== undefined ||
    input.payload.status !== undefined
  ) {
    await deps.trackKeycloakCall('update_user', () =>
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
    await deps.ensureManagedRealmRolesExist({
      instanceId: input.actor.instanceId,
      identityProvider: input.identityProvider,
      externalRoleNames: nextRoleNames,
      actorAccountId: input.actor.actorAccountId,
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });
    await deps.trackKeycloakCall('sync_roles', () =>
      input.identityProvider.provider.syncRoles(input.plan.existing.keycloakSubject, [...nextRoleNames])
    );
    input.shouldRestoreRolesRef.current = true;
  }
};

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
    readonly identityProvider: TIdentityProvider;
    readonly payload: TPayload;
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

  const resolvedIdentityState = await deps.resolveUpdatedIdentityState({
    plan,
    payload: input.payload,
    identityProvider: input.identityProvider,
  });

  const shouldRestoreIdentityRef = { current: false };
  const shouldRestoreRolesRef = { current: false };

  try {
    await syncUpdatedIdentityAndRoles(deps, {
      actor: input.actor,
      identityProvider: input.identityProvider,
      plan,
      payload: input.payload,
      nextIdentityAttributes: resolvedIdentityState.nextIdentityAttributes,
      shouldRestoreIdentityRef,
      shouldRestoreRolesRef,
    });

    const detail = await deps.persistUpdatedUserDetail({
      instanceId: input.actor.instanceId,
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
      actorAccountId: input.actor.actorAccountId,
      userId: input.userId,
      keycloakSubject: plan.existing.keycloakSubject,
      payload: input.payload,
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
      identityProvider: input.identityProvider,
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
