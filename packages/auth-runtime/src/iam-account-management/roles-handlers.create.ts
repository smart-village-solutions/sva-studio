import { createCreateRoleHandlerInternal } from '@sva/iam-admin';

import { jsonResponse } from '../db.js';

import { asApiItem, createApiError, parseRequestBody, requireIdempotencyKey, toPayloadHash } from './api-helpers.js';
import {
  buildRoleSyncFailure,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import { persistCreatedRole } from './role-mutation-persistence.js';
import { createRoleSchema } from './schemas.js';
import { completeIdempotency, reserveIdempotency } from './shared-idempotency.js';
import {
  iamRoleSyncCounter,
  iamUserOperationsCounter,
  logger,
  trackKeycloakCall,
} from './shared-observability.js';
import {
  buildRoleAttributes,
  requireRoleIdentityProvider,
  resolveRoleMutationActor,
} from './roles-handlers.shared.js';

export const createRoleInternal = createCreateRoleHandlerInternal({
  asApiItem,
  buildRoleAttributes,
  buildRoleSyncFailure,
  completeIdempotency,
  createApiError,
  iamRoleSyncCounter,
  iamUserOperationsCounter,
  jsonResponse,
  logger,
  mapRoleSyncErrorCode,
  parseCreateRoleBody: (request) => parseRequestBody(request, createRoleSchema),
  persistCreatedRole,
  requireIdempotencyKey,
  requireRoleIdentityProvider,
  reserveIdempotency,
  resolveRoleMutationActor,
  sanitizeRoleErrorMessage,
  toPayloadHash,
  trackKeycloakCall,
});
