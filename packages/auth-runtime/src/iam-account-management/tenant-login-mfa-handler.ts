import { getWorkspaceContext } from '@sva/server-runtime';
import type { TenantLoginMfaPolicyView } from '@sva/core';
import { z } from 'zod';
import type { AuthenticatedRequestContext } from '../middleware.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import { jsonResponse } from '../db.js';
import {
  withScopedRegistryRepository,
  withScopedRegistryService,
} from '../iam-instance-registry/repository.js';
import { asApiItem, createApiError, parseRequestBody } from './api-helpers.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { resolveMutationActorWithAccount } from './mutation-request-context.shared.js';
const ACTION = 'iam.authenticationPolicy.manage';
const schema = z
  .object({
    mode: z.enum(['optional', 'required']),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
const rejectInstance = (request: Request, requestId?: string) =>
  new URL(request.url).searchParams.has('instanceId')
    ? createApiError(400, 'invalid_request', 'An instance ID is not allowed here.', requestId)
    : null;

export const getTenantLoginMfaInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestId = getWorkspaceContext().requestId;
  const rejected =
    rejectInstance(request, requestId) ?? ensureFeature(getFeatureFlags(), 'iam_admin', requestId);
  if (rejected) return rejected;
  const instanceId = ctx.user.instanceId;
  if (!instanceId)
    return createApiError(403, 'forbidden', 'Tenant context is required.', requestId);
  const access = await authorizeInstancePermissionForUser({ ctx, action: ACTION, instanceId });
  if (!access.ok)
    return createApiError(
      access.status,
      toInstancePermissionApiErrorCode(access.error),
      access.message,
      requestId,
      access.permissionDenial
    );
  const instance = await withScopedRegistryRepository(instanceId, (repository) =>
    repository.getInstanceById(instanceId)
  );
  if (!instance) return createApiError(404, 'not_found', 'Instance not found.', requestId);
  const view: TenantLoginMfaPolicyView = {
    policy: instance.loginMfaPolicy ?? {
      desiredMode: 'optional',
      appliedMode: null,
      status: 'pending',
    },
    revision: instance.loginMfaRevision ?? 0,
    runId: instance.loginMfaRunId,
  };
  return jsonResponse(200, asApiItem(view, requestId));
};

export const updateTenantLoginMfaInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestId = getWorkspaceContext().requestId;
  const rejected = rejectInstance(request, requestId);
  if (rejected) return rejected;
  if (!ctx.user.instanceId)
    return createApiError(403, 'forbidden', 'Tenant context is required.', requestId);
  const resolved = await resolveMutationActorWithAccount(request, ctx, {
    allowedRoles: new Set(),
    requiredPermissionAction: ACTION,
    feature: 'iam_admin',
    scope: 'write',
    requestId,
  });
  if ('response' in resolved) return resolved.response;
  const actor = resolved.actor;
  if (actor.instanceId !== ctx.user.instanceId)
    return createApiError(403, 'forbidden', 'Tenant context mismatch.', requestId);
  const parsed = await parseRequestBody(request, schema);
  if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, requestId);
  try {
    const view = await withScopedRegistryService(actor.instanceId, (service) =>
      service.updateLoginMfaPolicy({
        ...parsed.data,
        instanceId: actor.instanceId,
        actorId: actor.actorAccountId,
        requestId,
      })
    );
    return jsonResponse(202, asApiItem(view, requestId));
  } catch (error) {
    if (error instanceof Error && error.message === 'login_mfa_revision_conflict')
      return createApiError(
        409,
        'conflict',
        'The authentication policy changed. Reload and retry.',
        requestId
      );
    throw error;
  }
};
