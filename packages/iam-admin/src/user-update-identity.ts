import { filterTenantTechnicalKeycloakRoleNames } from './role-governance.js';
import type {
  UpdatedIdentityStateShape,
  UpdateActor,
  UpdateIdentityProvider,
  UpdateUserHandlerDeps,
  UpdateUserPayloadShape,
  UserMainserverCredentialStateShape,
  UserUpdatePlanShape,
} from './user-update-contract.js';

export class RoleMutationCapabilityUnavailableError extends Error {
  constructor(readonly capability: 'assignRealmRoles' | 'removeRealmRoles') {
    super(`${capability} provider capability unavailable`);
    this.name = 'RoleMutationCapabilityUnavailableError';
  }
}

const resolveTechnicalRoleDelta = (input: {
  readonly previousRoleNames: readonly string[];
  readonly nextRoleNames: readonly string[];
}): {
  readonly addedRoleNames: readonly string[];
  readonly removedRoleNames: readonly string[];
} => {
  const previousRoleNames = new Set(
    filterTenantTechnicalKeycloakRoleNames(input.previousRoleNames)
  );
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

export const shouldResolveIdentityProvider = (input: {
  readonly payload: UpdateUserPayloadShape;
  readonly plan: UserUpdatePlanShape;
}): boolean => shouldUpdateUserIdentityPayload(input.payload) || hasTechnicalRoleDelta(input.plan);

export const resolveExistingMainserverCredentialState = (
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
    assignRealmRoles.call(input.identityProvider.provider, input.keycloakSubject, input.roleNames)
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
    removeRealmRoles.call(input.identityProvider.provider, input.keycloakSubject, input.roleNames)
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

export const syncUpdatedIdentityAndRoles = async <
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
