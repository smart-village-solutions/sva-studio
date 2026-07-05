import type { QueryClient } from './query-client.js';
import { filterTenantTechnicalKeycloakRoleNames } from './role-governance.js';

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
    readonly assignRealmRoles?: (keycloakSubject: string, roleNames: readonly string[]) => Promise<void>;
    readonly removeRealmRoles?: (keycloakSubject: string, roleNames: readonly string[]) => Promise<void>;
    readonly syncRoles: (keycloakSubject: string, roleNames: string[]) => Promise<void>;
  };
};

export class RoleMutationCapabilityUnavailableError extends Error {
  constructor(readonly capability: 'assignRealmRoles' | 'removeRealmRoles') {
    super(`${capability} provider capability unavailable`);
    this.name = 'RoleMutationCapabilityUnavailableError';
  }
}

export type UpdateUserPayloadShape = {
  readonly displayName?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecret?: string;
  readonly status?: 'active' | 'inactive' | 'pending';
};

export type UserUpdatePlanShape = {
  readonly existing: {
    readonly keycloakSubject: string;
    readonly mainserverUserApplicationId?: string;
    readonly mainserverUserApplicationSecretSet?: boolean;
    readonly roles?: readonly { readonly roleId: string }[];
    readonly groups?: readonly { readonly groupId: string }[];
  };
  readonly previousRoleNames: readonly string[];
  readonly nextRoleNames?: readonly string[];
};

export type UpdatedIdentityStateShape = {
  readonly existingIdentityAttributes?: UpdateIdentityAttributes;
  readonly nextIdentityAttributes?: UpdateIdentityAttributes;
  readonly nextMainserverCredentialState?: unknown;
};

type UserMainserverCredentialStateShape = {
  readonly mainserverUserApplicationId?: string;
  readonly mainserverUserApplicationSecretSet: boolean;
};

export type UpdateRequestContext<
  TPayload extends UpdateUserPayloadShape,
  TIdentityProvider extends UpdateIdentityProvider = UpdateIdentityProvider,
> =
  | Response
  | {
      readonly actor: UpdateActor;
      readonly identityProvider?: TIdentityProvider;
      readonly payload: TPayload;
      readonly resolveIdentityProvider?: () => Promise<TIdentityProvider | Response>;
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
    readonly roleKeys: readonly string[];
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
    readonly existingRoleIds?: readonly string[];
    readonly existingGroupIds?: readonly string[];
    readonly payload: TPayload;
    readonly existingMainserverCredentialState?: UserMainserverCredentialStateShape;
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
    readonly identityProvider?: TIdentityProvider;
  }) => Promise<void>;
  readonly resolveUpdateRequestContext: (
    request: Request,
    ctx: UpdateAuthenticatedRequestContext
  ) => Promise<UpdateRequestContext<TPayload, TIdentityProvider>>;
  readonly resolveUpdatedIdentityState: (input: {
    readonly plan: TPlan;
    readonly payload: TPayload;
    readonly identityProvider?: TIdentityProvider;
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
    operation: 'assign_realm_roles' | 'remove_realm_roles' | 'update_user',
    work: () => Promise<T>
  ) => Promise<T>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

const resolveTechnicalRoleDelta = (input: {
  readonly previousRoleNames: readonly string[];
  readonly nextRoleNames: readonly string[];
}): {
  readonly addedRoleNames: readonly string[];
  readonly removedRoleNames: readonly string[];
} => {
  const previousRoleNames = new Set(filterTenantTechnicalKeycloakRoleNames(input.previousRoleNames));
  const nextRoleNames = new Set(filterTenantTechnicalKeycloakRoleNames(input.nextRoleNames));

  return {
    addedRoleNames: [...nextRoleNames].filter((roleName) => !previousRoleNames.has(roleName)),
    removedRoleNames: [...previousRoleNames].filter((roleName) => !nextRoleNames.has(roleName)),
  };
};

const hasTechnicalRoleDelta = (plan: UserUpdatePlanShape): boolean => {
  if (!plan.nextRoleNames) {
    return false;
  }

  const { addedRoleNames, removedRoleNames } = resolveTechnicalRoleDelta({
    previousRoleNames: plan.previousRoleNames,
    nextRoleNames: plan.nextRoleNames,
  });
  return addedRoleNames.length > 0 || removedRoleNames.length > 0;
};

export const shouldUpdateUserIdentityAttributes = (payload: UpdateUserPayloadShape): boolean =>
  payload.displayName !== undefined ||
  payload.mainserverUserApplicationId !== undefined ||
  payload.mainserverUserApplicationSecret !== undefined;

export const shouldUpdateUserIdentityPayload = (payload: UpdateUserPayloadShape): boolean =>
  payload.email !== undefined ||
  payload.firstName !== undefined ||
  payload.lastName !== undefined ||
  shouldUpdateUserIdentityAttributes(payload) ||
  payload.status !== undefined;

const shouldResolveIdentityProvider = (input: {
  readonly payload: UpdateUserPayloadShape;
  readonly plan: UserUpdatePlanShape;
}): boolean => shouldUpdateUserIdentityPayload(input.payload) || hasTechnicalRoleDelta(input.plan);

const resolveExistingMainserverCredentialState = (
  existing: UserUpdatePlanShape['existing']
): UserMainserverCredentialStateShape | undefined =>
  existing.mainserverUserApplicationSecretSet === undefined
    ? undefined
    : {
        mainserverUserApplicationId: existing.mainserverUserApplicationId,
        mainserverUserApplicationSecretSet: existing.mainserverUserApplicationSecretSet,
      };

const requireRoleMutationCapability = (
  identityProvider: UpdateIdentityProvider,
  capability: 'assignRealmRoles' | 'removeRealmRoles'
): void => {
  if (!identityProvider.provider[capability]) {
    throw new RoleMutationCapabilityUnavailableError(capability);
  }
};

const syncUpdatedIdentity = async <
  TPayload extends UpdateUserPayloadShape,
  TPlan extends UserUpdatePlanShape,
  TIdentityState extends UpdatedIdentityStateShape,
  TIdentityProvider extends UpdateIdentityProvider,
>(
  deps: UpdateUserHandlerDeps<TPayload, TPlan, TIdentityState, TIdentityProvider>,
  input: {
    readonly identityProvider: TIdentityProvider;
    readonly plan: TPlan;
    readonly payload: TPayload;
    readonly nextIdentityAttributes?: TIdentityState['nextIdentityAttributes'];
  }
): Promise<boolean> => {
  const shouldUpdateIdentity =
    input.nextIdentityAttributes ||
    input.payload.email !== undefined ||
    input.payload.firstName !== undefined ||
    input.payload.lastName !== undefined ||
    input.payload.status !== undefined;
  if (!shouldUpdateIdentity) {
    return false;
  }

  await deps.trackKeycloakCall('update_user', () =>
    input.identityProvider.provider.updateUser(input.plan.existing.keycloakSubject, {
      email: input.payload.email,
      firstName: input.payload.firstName,
      lastName: input.payload.lastName,
      enabled: input.payload.status ? input.payload.status !== 'inactive' : undefined,
      attributes: input.nextIdentityAttributes,
    })
  );
  return true;
};

const assignTechnicalRoles = async <
  TPayload extends UpdateUserPayloadShape,
  TPlan extends UserUpdatePlanShape,
  TIdentityState extends UpdatedIdentityStateShape,
  TIdentityProvider extends UpdateIdentityProvider,
>(
  deps: UpdateUserHandlerDeps<TPayload, TPlan, TIdentityState, TIdentityProvider>,
  input: {
    readonly actor: UpdateActor;
    readonly identityProvider: TIdentityProvider;
    readonly keycloakSubject: string;
    readonly roleNames: readonly string[];
  }
): Promise<void> => {
  if (input.roleNames.length === 0) {
    return;
  }
  await deps.ensureManagedRealmRolesExist({
    instanceId: input.actor.instanceId,
    identityProvider: input.identityProvider,
    roleKeys: input.roleNames,
    actorAccountId: input.actor.actorAccountId,
    requestId: input.actor.requestId,
    traceId: input.actor.traceId,
  });
  const assignRealmRoles = input.identityProvider.provider.assignRealmRoles;
  if (!assignRealmRoles) {
    throw new RoleMutationCapabilityUnavailableError('assignRealmRoles');
  }
  await deps.trackKeycloakCall('assign_realm_roles', () =>
    input.identityProvider.provider.assignRealmRoles!(input.keycloakSubject, input.roleNames)
  );
};

const removeTechnicalRoles = async <
  TPayload extends UpdateUserPayloadShape,
  TPlan extends UserUpdatePlanShape,
  TIdentityState extends UpdatedIdentityStateShape,
  TIdentityProvider extends UpdateIdentityProvider,
>(
  deps: UpdateUserHandlerDeps<TPayload, TPlan, TIdentityState, TIdentityProvider>,
  input: {
    readonly identityProvider: TIdentityProvider;
    readonly keycloakSubject: string;
    readonly roleNames: readonly string[];
  }
): Promise<void> => {
  if (input.roleNames.length === 0) {
    return;
  }
  const removeRealmRoles = input.identityProvider.provider.removeRealmRoles;
  if (!removeRealmRoles) {
    throw new RoleMutationCapabilityUnavailableError('removeRealmRoles');
  }
  await deps.trackKeycloakCall('remove_realm_roles', () =>
    input.identityProvider.provider.removeRealmRoles!(input.keycloakSubject, input.roleNames)
  );
};

const syncUpdatedTechnicalRoles = async <
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
    readonly beforeRoleMutation: () => void;
  }
): Promise<boolean> => {
  if (!input.plan.nextRoleNames) {
    return false;
  }
  const { addedRoleNames, removedRoleNames } = resolveTechnicalRoleDelta({
    previousRoleNames: input.plan.previousRoleNames,
    nextRoleNames: input.plan.nextRoleNames,
  });
  if (addedRoleNames.length === 0 && removedRoleNames.length === 0) {
    return false;
  }
  requireRoleMutationCapability(input.identityProvider, 'assignRealmRoles');
  requireRoleMutationCapability(input.identityProvider, 'removeRealmRoles');
  input.beforeRoleMutation();

  await assignTechnicalRoles(deps, {
    actor: input.actor,
    identityProvider: input.identityProvider,
    keycloakSubject: input.plan.existing.keycloakSubject,
    roleNames: addedRoleNames,
  });
  await removeTechnicalRoles(deps, {
    identityProvider: input.identityProvider,
    keycloakSubject: input.plan.existing.keycloakSubject,
    roleNames: removedRoleNames,
  });

  return true;
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
  if (await syncUpdatedIdentity(deps, input)) {
    input.shouldRestoreIdentityRef.current = true;
  }

  await syncUpdatedTechnicalRoles(deps, {
    ...input,
    beforeRoleMutation: () => {
      input.shouldRestoreRolesRef.current = true;
    },
  });
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
