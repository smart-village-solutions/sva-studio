import { createUpdateRoleHandlerInternal } from '@sva/iam-admin';

import { jsonResponse } from '../shared/db-helpers.js';

import { asApiItem, createApiError, parseRequestBody } from './api-helpers.js';
import {
  buildRoleSyncFailure,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import {
  markRoleSyncState,
  persistUpdatedRole,
  resolveMutableRole,
} from './role-mutation-persistence.js';
import { updateRoleSchema } from './schemas.js';
import { iamRoleSyncCounter, logger, trackKeycloakCall } from './shared-observability.js';
import {
  buildRoleAttributes,
  requireRoleId,
  requireRoleIdentityProvider,
  resolveRoleMutationActor,
} from './roles-handlers.shared.js';

export const updateRoleInternal = createUpdateRoleHandlerInternal({
  asApiItem,
  buildRoleAttributes,
  buildRoleSyncFailure,
  createApiError,
  iamRoleSyncCounter,
  jsonResponse,
  logger,
  mapRoleSyncErrorCode,
  markRoleSyncState,
  parseUpdateRoleBody: (request) => parseRequestBody(request, updateRoleSchema),
  persistUpdatedRole,
  requireRoleId,
  requireRoleIdentityProvider,
  resolveMutableRole,
  resolveRoleMutationActor,
  sanitizeRoleErrorMessage,
  trackKeycloakCall,
});
