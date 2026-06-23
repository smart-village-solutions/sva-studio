import type { IdentityUserAttributes } from '../identity-provider-port.js';

import { buildMainserverIdentityAttributes } from '../mainserver-credentials.js';

import type { UpdateUserPayload, UserUpdatePlan } from './user-update-plan.js';
import { logger, resolveIdentityProvider, trackKeycloakCall } from './shared.js';

export const buildIdentityAttributesForUserUpdate = (input: {
  readonly existingAttributes: IdentityUserAttributes | undefined;
  readonly payload: UpdateUserPayload;
}): IdentityUserAttributes => {
  const attributes = buildMainserverIdentityAttributes({
    existingAttributes: input.existingAttributes,
    mainserverUserApplicationId: input.payload.mainserverUserApplicationId,
    mainserverUserApplicationSecret: input.payload.mainserverUserApplicationSecret,
  });

  if (input.payload.displayName !== undefined) {
    attributes.displayName = [input.payload.displayName];
  }

  return attributes;
};

const resolveRoleCompensationDelta = (plan: UserUpdatePlan): {
  readonly rolesToAssign: readonly string[];
  readonly rolesToRemove: readonly string[];
} => {
  const previousRoleNames = new Set(plan.previousRoleNames);
  const nextRoleNames = new Set(plan.nextRoleNames ?? []);

  return {
    rolesToAssign: [...previousRoleNames].filter((roleName) => !nextRoleNames.has(roleName)),
    rolesToRemove: [...nextRoleNames].filter((roleName) => !previousRoleNames.has(roleName)),
  };
};

const compensateUserRoleDelta = async (input: {
  readonly identityProvider: NonNullable<ReturnType<typeof resolveIdentityProvider>>;
  readonly keycloakSubject: string;
  readonly rolesToAssign: readonly string[];
  readonly rolesToRemove: readonly string[];
}): Promise<void> => {
  if (input.rolesToAssign.length > 0) {
    if (!input.identityProvider.provider.assignRealmRoles) {
      throw new Error('assignRealmRoles provider capability unavailable');
    }
    await trackKeycloakCall('sync_roles_compensation', () =>
      input.identityProvider.provider.assignRealmRoles!(input.keycloakSubject, input.rolesToAssign)
    );
  }

  if (input.rolesToRemove.length > 0) {
    if (!input.identityProvider.provider.removeRealmRoles) {
      throw new Error('removeRealmRoles provider capability unavailable');
    }
    await trackKeycloakCall('sync_roles_compensation', () =>
      input.identityProvider.provider.removeRealmRoles!(input.keycloakSubject, input.rolesToRemove)
    );
  }
};

export const compensateUserIdentityUpdate = async (input: {
  instanceId: string;
  requestId?: string;
  traceId?: string;
  userId: string;
  plan: UserUpdatePlan;
  restoreIdentity: boolean;
  restoreRoles: boolean;
  restoreIdentityAttributes?: IdentityUserAttributes;
  identityProvider: NonNullable<ReturnType<typeof resolveIdentityProvider>>;
}): Promise<void> => {
  const {
    identityProvider,
    instanceId,
    plan,
    requestId,
    restoreIdentity,
    restoreRoles,
    restoreIdentityAttributes,
    traceId,
    userId,
  } = input;

  if (restoreIdentity) {
    try {
      await trackKeycloakCall('update_user_compensation', () =>
        identityProvider.provider.updateUser(plan.existing.keycloakSubject, {
          email: plan.existing.email,
          firstName: plan.existing.firstName,
          lastName: plan.existing.lastName,
          enabled: plan.existing.status !== 'inactive',
          attributes: restoreIdentityAttributes,
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

  if (!restoreRoles) {
    return;
  }

  try {
    await compensateUserRoleDelta({
      identityProvider,
      keycloakSubject: plan.existing.keycloakSubject,
      ...resolveRoleCompensationDelta(plan),
    });
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
};
