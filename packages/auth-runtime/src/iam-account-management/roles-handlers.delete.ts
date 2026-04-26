import { createDeleteRoleHandlerInternal } from '@sva/iam-admin';

import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';
import { jsonResponse } from '../db.js';

import { asApiItem, createApiError } from './api-helpers.js';
import { mapRoleSyncErrorCode, sanitizeRoleErrorMessage } from './role-audit.js';
import {
  deleteRoleFromDatabase,
  markDeleteRoleSyncState,
  resolveDeletableRole,
} from './role-mutation-persistence.js';
import { iamRoleSyncCounter, logger, trackKeycloakCall } from './shared-observability.js';
import {
  buildRoleAttributes,
  requireRoleId,
  requireRoleIdentityProvider,
  resolveRoleMutationActor,
} from './roles-handlers.shared.js';

export const deleteRoleInternal = createDeleteRoleHandlerInternal({
  asApiItem,
  buildRoleAttributes,
  createApiError,
  deleteRoleFromDatabase,
  iamRoleSyncCounter,
  isIdentityRoleNotFoundError: (error) => error instanceof KeycloakAdminRequestError && error.statusCode === 404,
  jsonResponse,
  logger,
  mapRoleSyncErrorCode,
  markDeleteRoleSyncState,
  requireRoleId,
  requireRoleIdentityProvider,
  resolveDeletableRole,
  resolveRoleMutationActor,
  sanitizeRoleErrorMessage,
  trackKeycloakCall,
});
