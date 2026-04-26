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
} from '@sva/iam-admin';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { getSession, updateSession } from '../redis-session.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
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
  updateSession,
  validateCsrf,
  withInstanceScopedDb,
});

const { getOrganizationInternal, listOrganizationsInternal } = organizationReadHandlers;

const { createOrganizationInternal } = organizationMutationHandlers;

const { updateOrganizationInternal } = organizationMutationHandlers;

const { deactivateOrganizationInternal } = organizationMutationHandlers;

const { assignOrganizationMembershipInternal } = organizationMutationHandlers;

const { removeOrganizationMembershipInternal } = organizationMutationHandlers;

const { getMyOrganizationContextInternal } = organizationReadHandlers;

const { updateMyOrganizationContextInternal } = organizationMutationHandlers;

export {
  assignOrganizationMembershipInternal,
  createOrganizationInternal,
  deactivateOrganizationInternal,
  getMyOrganizationContextInternal,
  getOrganizationInternal,
  listOrganizationsInternal,
  removeOrganizationMembershipInternal,
  updateMyOrganizationContextInternal,
  updateOrganizationInternal,
};
