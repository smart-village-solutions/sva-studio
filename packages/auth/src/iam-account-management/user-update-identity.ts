import type { IdentityUserAttributes } from '../identity-provider-port.js';

import { buildMainserverIdentityAttributes } from '../mainserver-credentials.server.js';

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
};
