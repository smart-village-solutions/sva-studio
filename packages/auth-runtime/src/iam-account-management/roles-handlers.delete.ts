import { createDeleteRoleHandlerInternal } from '@sva/iam-admin';

import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';
import { jsonResponse } from '../db.js';

import { asApiItem, createApiError } from './api-helpers.js';
import { mapRoleSyncErrorCode, sanitizeRoleErrorMessage } from './role-audit.js';
import {
  deleteRoleFromDatabase,
  listDirectRoleAssignmentSubjects,
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

const deleteRoleHandlerDeps = {
  asApiItem,
  buildRoleAttributes,
  createApiError,
  deleteRoleFromDatabase,
  iamRoleSyncCounter,
  isIdentityRoleNotFoundError: (error) => error instanceof KeycloakAdminRequestError && error.statusCode === 404,
  jsonResponse,
  listDirectRoleAssignmentSubjects,
  logger,
  mapRoleSyncErrorCode,
  markDeleteRoleSyncState,
  requireRoleId,
  requireRoleIdentityProvider,
  resolveDeletableRole,
  resolveRoleMutationActor,
  sanitizeRoleErrorMessage,
  trackKeycloakCall,
} as Parameters<typeof createDeleteRoleHandlerInternal>[0] & {
  readonly listDirectRoleAssignmentSubjects: typeof listDirectRoleAssignmentSubjects;
};

export const deleteRoleInternal = createDeleteRoleHandlerInternal(deleteRoleHandlerDeps);
