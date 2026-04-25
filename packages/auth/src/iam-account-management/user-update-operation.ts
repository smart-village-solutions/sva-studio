import { createUserUpdatePersistence } from '@sva/iam-admin';

import type { IdentityUserAttributes } from '../identity-provider-port.js';
import {
  getSvaMainserverCredentialAttributeNames,
  resolveMainserverCredentialState,
} from '../mainserver-credentials.server.js';

import { assignGroups, assignRoles } from './shared-assignment.js';
import { emitActivityLog, notifyPermissionInvalidation } from './shared-activity.js';
import { trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb, resolveIdentityProvider } from './shared-runtime.js';
import { resolveUserDetail } from './user-detail-query.js';
import {
  buildIdentityAttributesForUserUpdate,
} from './user-update-identity.js';
import type { UpdateUserPayload, UserUpdatePlan } from './user-update-plan.js';

export const resolveUpdatedIdentityState = async (input: {
  plan: UserUpdatePlan;
  payload: UpdateUserPayload;
  identityProvider: NonNullable<ReturnType<typeof resolveIdentityProvider>>;
}) => {
  const shouldUpdateIdentityAttributes =
    input.payload.displayName !== undefined ||
    input.payload.mainserverUserApplicationId !== undefined ||
    input.payload.mainserverUserApplicationSecret !== undefined;
  const shouldUpdateIdentity =
    input.payload.email !== undefined ||
    input.payload.firstName !== undefined ||
    input.payload.lastName !== undefined ||
    input.payload.status !== undefined ||
    shouldUpdateIdentityAttributes;

  let existingIdentityAttributes: IdentityUserAttributes | undefined;
  let nextIdentityAttributes: IdentityUserAttributes | undefined;
  let nextMainserverCredentialState: ReturnType<typeof resolveMainserverCredentialState>;

  if (shouldUpdateIdentityAttributes) {
    existingIdentityAttributes = await trackKeycloakCall('get_user_attributes_for_update', () =>
      input.identityProvider.provider.getUserAttributes(input.plan.existing.keycloakSubject)
    );
    nextIdentityAttributes = buildIdentityAttributesForUserUpdate({
      existingAttributes: existingIdentityAttributes,
      payload: input.payload,
    });
    nextMainserverCredentialState = resolveMainserverCredentialState(nextIdentityAttributes);
  } else {
    nextMainserverCredentialState = await trackKeycloakCall('get_user_attributes_for_response', () =>
      input.identityProvider.provider
        .getUserAttributes(input.plan.existing.keycloakSubject, getSvaMainserverCredentialAttributeNames())
        .then((attributes) => resolveMainserverCredentialState(attributes))
    );
  }

  return {
    existingIdentityAttributes,
    nextIdentityAttributes,
    nextMainserverCredentialState,
    shouldUpdateIdentity,
  };
};

export const { persistUpdatedUserDetail } = createUserUpdatePersistence({
  assignGroups,
  assignRoles,
  emitActivityLog,
  notifyPermissionInvalidation,
  resolveUserDetail,
  withInstanceScopedDb,
});
