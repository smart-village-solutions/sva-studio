import {
  AccountInvitationTemplateValidationError,
  resolveEffectiveAccountInvitationTemplate,
  validateAccountInvitationTemplate,
  type TenantAccountInvitationTemplateView,
} from '@sva/core';
import { updateInstanceSchema } from '@sva/instance-registry/http-contracts';
import { getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import type { AuthenticatedRequestContext } from '../middleware.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import { jsonResponse } from '../db.js';
import {
  withRegistryRepository,
  withScopedRegistryRepository,
} from '../iam-instance-registry/repository.js';
import { asApiItem, createApiError, parseRequestBody } from './api-helpers.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { resolveMutationActorWithAccount } from './mutation-request-context.shared.js';

const ACTION = 'iam.invitationTemplate.manage';
const mutationSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    template: updateInstanceSchema.shape.accountInvitationTemplate.unwrap(),
  })
  .strict();

const rejectRequestedInstance = (request: Request, requestId?: string): Response | null =>
  new URL(request.url).searchParams.has('instanceId')
    ? createApiError(400, 'invalid_request', 'Eine Instanz-ID ist hier nicht erlaubt.', requestId)
    : null;

const readView = async (
  instanceId: string
): Promise<TenantAccountInvitationTemplateView | null> => {
  const instance = await withScopedRegistryRepository(instanceId, (repository) =>
    repository.getInstanceById(instanceId)
  );
  if (!instance) return null;
  const serverTemplate = await withRegistryRepository((repository) =>
    repository.getServerAccountInvitationTemplate()
  );
  const effective = resolveEffectiveAccountInvitationTemplate({
    instanceTemplate: instance.accountInvitationTemplate,
    serverTemplate: serverTemplate.template,
  });
  return {
    revision: instance.accountInvitationTemplate?.revision ?? 0,
    effectiveTemplate: effective.template,
    source: effective.source,
    tenantName: instance.displayName,
    tenantHomepageUrl: `https://${instance.primaryHostname}/`,
  };
};

export const getTenantInvitationTemplateInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestId = getWorkspaceContext().requestId;
  const requestedInstance = rejectRequestedInstance(request, requestId);
  if (requestedInstance) return requestedInstance;
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestId);
  if (featureCheck) return featureCheck;
  const instanceId = ctx.user.instanceId;
  if (!instanceId) {
    return createApiError(403, 'forbidden', 'Tenant-Kontext fehlt.', requestId);
  }
  const access = await authorizeInstancePermissionForUser({ ctx, action: ACTION, instanceId });
  if (!access.ok) {
    return createApiError(
      access.status,
      toInstancePermissionApiErrorCode(access.error),
      access.message,
      requestId,
      access.permissionDenial
    );
  }
  const view = await readView(instanceId);
  return view
    ? jsonResponse(200, asApiItem(view, requestId))
    : createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', requestId);
};

export const updateTenantInvitationTemplateInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestId = getWorkspaceContext().requestId;
  const requestedInstance = rejectRequestedInstance(request, requestId);
  if (requestedInstance) return requestedInstance;
  if (!ctx.user.instanceId) {
    return createApiError(403, 'forbidden', 'Tenant-Kontext fehlt.', requestId);
  }
  const actorResolution = await resolveMutationActorWithAccount(request, ctx, {
    allowedRoles: new Set(),
    requiredPermissionAction: ACTION,
    feature: 'iam_admin',
    scope: 'write',
    requestId,
  });
  if ('response' in actorResolution) return actorResolution.response;
  const actor = actorResolution.actor;
  if (actor.instanceId !== ctx.user.instanceId) {
    return createApiError(403, 'forbidden', 'Tenant-Kontext stimmt nicht überein.', requestId);
  }
  const parsed = await parseRequestBody(request, mutationSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }
  try {
    if (parsed.data.template) validateAccountInvitationTemplate(parsed.data.template);
    const updated = await withScopedRegistryRepository(actor.instanceId, (repository) =>
      repository.updateAccountInvitationTemplate({
        instanceId: actor.instanceId,
        expectedRevision: parsed.data.expectedRevision,
        template: parsed.data.template
          ? { ...parsed.data.template, revision: parsed.data.expectedRevision + 1 }
          : null,
        actorId: actor.actorAccountId,
      })
    );
    if (!updated) {
      return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', requestId);
    }
    const view = await readView(actor.instanceId);
    return view
      ? jsonResponse(200, asApiItem(view, requestId))
      : createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', requestId);
  } catch (error) {
    if (error instanceof AccountInvitationTemplateValidationError) {
      return createApiError(400, 'invalid_account_invitation_template', error.message, requestId);
    }
    if (
      error instanceof Error &&
      error.message === 'account_invitation_template_revision_conflict'
    ) {
      return createApiError(
        409,
        'account_invitation_template_revision_conflict',
        'Die Vorlage wurde gleichzeitig geändert.',
        requestId
      );
    }
    throw error;
  }
};
