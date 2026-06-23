import {
  createUserUpdatePersistence,
  shouldUpdateUserIdentityAttributes,
  shouldUpdateUserIdentityPayload,
} from '@sva/iam-admin';

import type { IdentityUserAttributes } from '../identity-provider-port.js';
import {
  getSvaMainserverCredentialAttributeNames,
  resolveMainserverCredentialState,
} from '../mainserver-credentials.js';

import { assignGroups, assignRoles } from './shared-assignment.js';
import { emitActivityLog, notifyPermissionInvalidation } from './shared-activity.js';
import { trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import { resolveUserDetail } from './user-detail-query.js';
import { revokeUserSessions } from '../session-revocation.js';
import { clearUserSessionLoginBlock } from '../session-revocation.js';
import {
  buildIdentityAttributesForUserUpdate,
} from './user-update-identity.js';
import type { UpdateUserPayload, UserUpdatePlan } from './user-update-plan.js';
import type { UserUpdateIdentityProviderResolution } from './user-update-request-context.js';

export const resolveUpdatedIdentityState = async (input: {
  plan: UserUpdatePlan;
  payload: UpdateUserPayload;
  identityProvider?: UserUpdateIdentityProviderResolution;
}) => {
  const shouldUpdateIdentityAttributes = shouldUpdateUserIdentityAttributes(input.payload);
  const shouldUpdateIdentity = shouldUpdateUserIdentityPayload(input.payload);

  let existingIdentityAttributes: IdentityUserAttributes | undefined;
  let nextIdentityAttributes: IdentityUserAttributes | undefined;
  let nextMainserverCredentialState: ReturnType<typeof resolveMainserverCredentialState> | undefined;

  if (shouldUpdateIdentityAttributes) {
    const identityProvider = input.identityProvider;
    if (!identityProvider) {
      throw new Error('identity_provider_resolution_unavailable');
    }
    existingIdentityAttributes = await trackKeycloakCall('get_user_attributes_for_update', () =>
      identityProvider.provider.getUserAttributes(input.plan.existing.keycloakSubject)
    );
    nextIdentityAttributes = buildIdentityAttributesForUserUpdate({
      existingAttributes: existingIdentityAttributes,
      payload: input.payload,
    });
    nextMainserverCredentialState = resolveMainserverCredentialState(nextIdentityAttributes);
  } else if (shouldUpdateIdentity && input.identityProvider) {
    const { identityProvider } = input;
    nextMainserverCredentialState = await trackKeycloakCall('get_user_attributes_for_response', () =>
      identityProvider.provider
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
  clearUserSessionLoginBlock,
  emitActivityLog,
  notifyPermissionInvalidation,
  revokeUserSessions,
  resolveUserDetail,
  withInstanceScopedDb,
});
