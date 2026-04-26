import { createLegacyGroupMutationHandlers, createLegacyGroupReadHandlers } from '@sva/iam-admin';
import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';
import { jsonResponse } from '../db.js';
import { isUuid } from '../shared/input-readers.js';

import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from './api-helpers.js';
import { validateCsrf } from './csrf.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import {
  completeIdempotency,
  emitActivityLog,
  iamUserOperationsCounter,
  logger,
  notifyPermissionInvalidation,
  requireRoles,
  reserveIdempotency,
  resolveActorInfo,
  resolveRolesByIds,
  withInstanceScopedDb,
} from './shared.js';

const legacyGroupReadHandlers = createLegacyGroupReadHandlers({
  asApiItem,
  asApiList,
  consumeRateLimit,
  createApiError,
  ensureFeature,
  getFeatureFlags,
  getWorkspaceContext,
  isUuid,
  jsonResponse,
  readPathSegment,
  requireRoles,
  resolveActorInfo,
  withInstanceScopedDb,
});

const legacyGroupMutationHandlers = createLegacyGroupMutationHandlers({
  asApiItem,
  completeIdempotency,
  consumeRateLimit,
  createApiError,
  emitActivityLog,
  ensureFeature,
  getFeatureFlags,
  getWorkspaceContext,
  iamUserOperationsCounter,
  isUuid,
  jsonResponse,
  logger,
  notifyPermissionInvalidation,
  parseRequestBody,
  readPathSegment,
  requireIdempotencyKey,
  requireRoles,
  reserveIdempotency,
  resolveActorInfo,
  resolveRolesByIds,
  toPayloadHash,
  validateCsrf,
  withInstanceScopedDb,
});

export const { getGroupInternal, listGroupsInternal } = legacyGroupReadHandlers;
export const { createGroupInternal, deleteGroupInternal, updateGroupInternal } = legacyGroupMutationHandlers;
