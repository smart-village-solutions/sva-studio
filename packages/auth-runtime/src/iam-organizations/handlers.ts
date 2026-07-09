import { randomUUID } from 'node:crypto';

import {
  chooseActiveOrganizationId,
  createOrganizationMutationHandlers,
  createOrganizationReadHandlers,
  isHierarchyError,
  loadContextOptions,
  loadOrganizationById,
  loadOrganizationDetail,
  loadOrganizationList,
  readOrganizationTypeFilter,
  readStatusFilter,
  rebuildOrganizationSubtree,
  resolveHierarchyFields,
  upsertOrganizationMainserverCredentials,
} from '@sva/iam-admin';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { getSession, updateSession } from '../redis-session.js';
import { jsonResponse } from '../db.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import { isUuid, readString } from '../shared/input-readers.js';

import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  readPage,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from '../iam-account-management/api-helpers.js';
import { createActorResolutionDetails } from '../iam-account-management/diagnostics.js';
import { consumeRateLimit } from '../iam-account-management/rate-limit.js';
import {
  completeIdempotency,
  emitActivityLog,
  notifyPermissionInvalidation,
  requireRoles,
  reserveIdempotency,
  resolveActorInfo,
  withInstanceScopedDb,
} from '../iam-account-management/shared.js';
import { ensureFeature, getFeatureFlags } from '../iam-account-management/feature-flags.js';
import { validateCsrf } from '../iam-account-management/csrf.js';

const logger = createSdkLogger({ component: 'iam-organizations', level: 'info' });

const organizationReadHandlers = createOrganizationReadHandlers({
  asApiItem,
  asApiList,
  chooseActiveOrganizationId,
  consumeRateLimit,
  createApiError,
  ensureFeature,
  getFeatureFlags,
  getSession,
  getWorkspaceContext,
  isUuid,
  jsonResponse,
  authorizeOrganizationReadAccess: (_request, ctx, requestId) =>
    authorizeInstancePermissionForUser({ ctx, action: 'iam.org.read' }).then((result) =>
      result.ok ? null : createApiError(result.status, toInstancePermissionApiErrorCode(result.error), result.message, requestId)
    ),
  loadContextOptions,
  loadOrganizationDetail,
  loadOrganizationList,
  readOrganizationTypeFilter,
  readPage,
  readPathSegment,
  readStatusFilter,
  readString,
  requireRoles,
  resolveActorInfo,
  updateSession,
  withInstanceScopedDb,
});

const organizationMutationHandlers = createOrganizationMutationHandlers({
  asApiItem,
  completeIdempotency,
  consumeRateLimit,
  createActorResolutionDetails,
  createApiError,
  emitActivityLog,
  ensureFeature,
  getFeatureFlags,
  getWorkspaceContext,
  isHierarchyError,
  isUuid,
  jsonResponse,
  authorizeOrganizationMutationAccess: (_request, ctx, requestId) =>
    authorizeInstancePermissionForUser({ ctx, action: 'iam.org.write' }).then((result) =>
      result.ok ? null : createApiError(result.status, toInstancePermissionApiErrorCode(result.error), result.message, requestId)
    ),
  loadContextOptions,
  loadOrganizationById,
  loadOrganizationDetail,
  logger,
  notifyPermissionInvalidation,
  parseRequestBody,
  randomUUID,
  readPathSegment,
  rebuildOrganizationSubtree,
  requireIdempotencyKey,
  requireRoles,
  reserveIdempotency,
  resolveActorInfo,
  resolveHierarchyFields,
  toPayloadHash,
  upsertOrganizationMainserverCredentials,
  updateSession,
  validateCsrf,
  withInstanceScopedDb,
});

const { getOrganizationInternal, listOrganizationsInternal } = organizationReadHandlers;

const { createOrganizationInternal } = organizationMutationHandlers;

const { updateOrganizationInternal } = organizationMutationHandlers;

const { deleteOrganizationInternal } = organizationMutationHandlers;

const { assignOrganizationMembershipInternal } = organizationMutationHandlers;

const { removeOrganizationMembershipInternal } = organizationMutationHandlers;

const { updateOrganizationMembershipInternal } = organizationMutationHandlers;

const { getMyOrganizationContextInternal } = organizationReadHandlers;

const { updateMyOrganizationContextInternal } = organizationMutationHandlers;

export {
  assignOrganizationMembershipInternal,
  createOrganizationInternal,
  deleteOrganizationInternal,
  getMyOrganizationContextInternal,
  getOrganizationInternal,
  listOrganizationsInternal,
  removeOrganizationMembershipInternal,
  updateOrganizationMembershipInternal,
  updateMyOrganizationContextInternal,
  updateOrganizationInternal,
};
