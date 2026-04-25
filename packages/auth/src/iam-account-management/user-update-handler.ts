import { createUpdateUserHandlerInternal } from '@sva/iam-admin';

import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from '../keycloak-admin-client.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { asApiItem, createApiError } from './api-helpers.js';
import { buildRoleSyncFailure } from './role-audit.js';
import { ensureManagedRealmRolesExist } from './shared-managed-role-sync.js';
import { iamUserOperationsCounter, logger, trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import { compensateUserIdentityUpdate } from './user-update-identity.js';
import { createUnexpectedMutationErrorResponse, createUserMutationErrorResponse } from './user-mutation-errors.js';
import { resolveUpdatedIdentityState, persistUpdatedUserDetail } from './user-update-operation.js';
import { resolveUpdateRequestContext } from './user-update-request-context.js';
import { resolveUserUpdatePlan } from './user-update-plan.js';

export const updateUserInternal = createUpdateUserHandlerInternal({
  asApiItem,
  compensateUserIdentityUpdate,
  createUnexpectedMutationErrorResponse,
  createUserMutationErrorResponse,
  ensureManagedRealmRolesExist,
  handleKeycloakUpdateError: ({ error, requestId }) => {
    if (error instanceof KeycloakAdminRequestError || error instanceof KeycloakAdminUnavailableError) {
      return buildRoleSyncFailure({
        error,
        requestId,
        fallbackMessage: 'Nutzerrollen konnten nicht mit Keycloak synchronisiert werden.',
      });
    }

    return null;
  },
  iamUserOperationsCounter,
  jsonResponse,
  logger,
  notFoundResponse: (requestId) => createApiError(404, 'not_found', 'Nutzer nicht gefunden.', requestId),
  persistUpdatedUserDetail,
  resolveUpdateRequestContext,
  resolveUpdatedIdentityState,
  resolveUserUpdatePlan,
  trackKeycloakCall,
  withInstanceScopedDb,
});
