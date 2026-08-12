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
  readOrganizationListSort,
  readOrganizationTypeFilter,
  readStatusFilter,
  rebuildOrganizationSubtree,
  resolveHierarchyFields,
  upsertOrganizationMainserverCredentials,
} from '@sva/iam-admin';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';
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
import { ADMIN_ROLES } from '../iam-account-management/constants.js';
import { resolveMutationActorWithAccount } from '../iam-account-management/mutation-request-context.shared.js';
import { provisionOrganizationMainserver } from './organization-mainserver-provisioning.js';

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
      result.ok
        ? null
        : createApiError(
            result.status,
            toInstancePermissionApiErrorCode(result.error),
            result.message,
            requestId,
            result.permissionDenial
          )
    ),
  loadContextOptions,
  loadOrganizationDetail,
  loadOrganizationList,
  readOrganizationListSort,
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
  afterOrganizationCreated: async ({ actor, actorSubject, organization }) => {
    const organizationId = (organization as { readonly id?: string }).id;
    if (!organizationId) {
      return organization;
    }
    const result = await provisionOrganizationMainserver({
      instanceId: actor.instanceId,
      organizationId,
      actorAccountId: actor.actorAccountId,
      actorSubject,
      trigger: 'organization_create',
      requestId: actor.requestId,
      traceId: actor.traceId,
    });
    return result.organization;
  },
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
      result.ok
        ? null
        : createApiError(
            result.status,
            toInstancePermissionApiErrorCode(result.error),
            result.message,
            requestId,
            result.permissionDenial
          )
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

const provisionOrganizationMainserverInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await resolveMutationActorWithAccount(request, ctx, {
    allowedRoles: ADMIN_ROLES,
    requiredPermissionAction: 'iam.org.write',
    feature: 'iam_admin',
    scope: 'write',
    provisionMissingActorMembership: true,
  });
  if ('response' in actorResolution) {
    return actorResolution.response;
  }

  const organizationId = readPathSegment(request, 4);
  if (!organizationId || !isUuid(organizationId)) {
    return createApiError(
      400,
      'invalid_organization_id',
      'Ungültige organizationId.',
      actorResolution.actor.requestId
    );
  }
  const idempotency = requireIdempotencyKey(request, actorResolution.actor.requestId);
  if ('error' in idempotency) {
    return idempotency.error;
  }

  try {
    const result = await provisionOrganizationMainserver({
      instanceId: actorResolution.actor.instanceId,
      organizationId,
      actorAccountId: actorResolution.actor.actorAccountId,
      actorSubject: ctx.user.id,
      trigger: 'explicit_retry',
      operationReference: toPayloadHash(`${organizationId}:${idempotency.key}`),
      requestId: actorResolution.actor.requestId,
      traceId: actorResolution.actor.traceId,
    });
    return jsonResponse(200, asApiItem(result.organization, actorResolution.actor.requestId));
  } catch (error) {
    logger.error('Organization Mainserver provisioning request failed before reservation', {
      workspace_id: actorResolution.actor.instanceId,
      context: {
        operation: 'organization_mainserver_provisioning_request',
        organization_id: organizationId,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
      },
    });
    return error instanceof Error && error.message === 'organization_not_found'
      ? createApiError(
          404,
          'not_found',
          'Organisation wurde nicht gefunden.',
          actorResolution.actor.requestId
        )
      : createApiError(
          500,
          'mainserver_provisioning_failed',
          'Mainserver-Provisioning konnte nicht gestartet werden.',
          actorResolution.actor.requestId
        );
  }
};

export {
  assignOrganizationMembershipInternal,
  createOrganizationInternal,
  deleteOrganizationInternal,
  getMyOrganizationContextInternal,
  getOrganizationInternal,
  listOrganizationsInternal,
  provisionOrganizationMainserverInternal,
  removeOrganizationMembershipInternal,
  updateOrganizationMembershipInternal,
  updateMyOrganizationContextInternal,
  updateOrganizationInternal,
};
