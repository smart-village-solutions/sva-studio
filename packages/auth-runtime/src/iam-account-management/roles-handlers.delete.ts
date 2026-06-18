import {
  createDeleteRoleHandlerInternal,
  type DeleteRoleHandlerDeps,
} from '@sva/iam-admin';

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

type DeleteRoleIdentityProvider = Exclude<
  Awaited<ReturnType<typeof requireRoleIdentityProvider>>,
  Response
>;

type DeleteRoleDeps = DeleteRoleHandlerDeps<
  ReturnType<typeof buildRoleAttributes>,
  DeleteRoleIdentityProvider
> & {
  readonly listDirectRoleAssignmentSubjects: typeof listDirectRoleAssignmentSubjects;
  readonly requireRoleIdentityProvider: typeof requireRoleIdentityProvider;
};

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
} satisfies DeleteRoleDeps;

export const deleteRoleInternal = createDeleteRoleHandlerInternal(deleteRoleHandlerDeps);
