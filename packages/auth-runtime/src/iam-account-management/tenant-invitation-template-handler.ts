import {
  readMailTemplate,
  mutateMailTemplate,
  synchronizeMailTemplate,
  MailTemplateConflict,
} from '../iam-instance-registry/mail-template-sync.js';
import {
  AccountInvitationTemplateValidationError,
  resolveEffectiveAccountInvitationTemplate,
  validateAccountInvitationTemplate,
  type TenantAccountInvitationTemplateView,
  type MailTemplateKind,
  EmailVerificationTemplateError,
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
import {
  resolveMutationActorWithAccount,
  type MutationActorWithAccount,
} from './mutation-request-context.shared.js';

const ACTION = 'iam.invitationTemplate.manage';
const mutationSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    template: updateInstanceSchema.shape.accountInvitationTemplate.unwrap().optional(),
    operation: z.enum(['save', 'transfer', 'adopt']).optional(),
    expectedStudioTexts: z.record(z.string(), z.string()).optional(),
    expectedKeycloakTexts: z.record(z.string(), z.string()).optional(),
  })
  .strict();
const verificationMutationSchema = mutationSchema.extend({
  template: z
    .object({ subject: z.string().max(200), body: z.string().max(5000) })
    .strict()
    .nullable()
    .optional(),
});

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
    revision:
      instance.accountInvitationTemplateRevision ??
      instance.accountInvitationTemplate?.revision ??
      0,
    synchronization: await readMailTemplate(instanceId, 'invitation'),
    effectiveTemplate: effective.template,
    source: effective.source,
    tenantName: instance.displayName,
    tenantHomepageUrl: `https://${instance.primaryHostname}/`,
  };
};

export const getTenantInvitationTemplateInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  kind: MailTemplateKind = 'invitation'
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
  const view =
    kind === 'verification' ? await readMailTemplate(instanceId, kind) : await readView(instanceId);
  return view
    ? jsonResponse(200, asApiItem(view, requestId))
    : createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', requestId);
};

const isRevisionConflict = (error: unknown, code: string) =>
  error instanceof MailTemplateConflict || (error instanceof Error && error.message === code);

const invitationSource = (data: z.infer<typeof mutationSchema>) =>
  data.template ? { ...data.template, revision: data.expectedRevision + 1 } : null;

const updateVerificationTemplate = async (
  request: Request,
  actor: MutationActorWithAccount
): Promise<Response> => {
  const requestId = getWorkspaceContext().requestId;
  const parsed = await parseRequestBody(request, verificationMutationSchema);
  if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, requestId);
  if (
    (!parsed.data.operation || parsed.data.operation === 'save') &&
    parsed.data.template === undefined
  )
    return createApiError(400, 'invalid_request', 'Vorlage fehlt.', requestId);
  try {
    const data = await mutateMailTemplate(
      actor.instanceId,
      'verification',
      {
        ...parsed.data,
        operation: parsed.data.operation ?? 'save',
      },
      actor.actorAccountId
    );
    return jsonResponse(200, asApiItem(data, requestId));
  } catch (error) {
    if (isRevisionConflict(error, 'mail_template_revision_conflict'))
      return createApiError(
        409,
        'mail_template_conflict',
        'Die Vorlage wurde gleichzeitig geändert.',
        requestId
      );
    if (
      error instanceof EmailVerificationTemplateError ||
      (error instanceof Error && error.message === 'mail_template_adoption_unsupported')
    )
      return createApiError(400, 'invalid_mail_template', 'Ungültige E-Mail-Vorlage.', requestId);
    if (error instanceof Error && error.message === 'not_found')
      return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', requestId);
    throw error;
  }
};

export const updateTenantInvitationTemplateInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  kind: MailTemplateKind = 'invitation'
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
  if (kind === 'verification') return updateVerificationTemplate(request, actor);
  const parsed = await parseRequestBody(request, mutationSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, requestId);
  }
  try {
    if (parsed.data.operation && parsed.data.operation !== 'save') {
      await mutateMailTemplate(
        actor.instanceId,
        'invitation',
        { ...parsed.data, operation: parsed.data.operation },
        actor.actorAccountId
      );
      return jsonResponse(200, asApiItem(await readView(actor.instanceId), requestId));
    }
    if (parsed.data.template === undefined)
      return createApiError(400, 'invalid_request', 'Vorlage fehlt.', requestId);
    if (parsed.data.template) validateAccountInvitationTemplate(parsed.data.template);
    const updated = await withScopedRegistryRepository(actor.instanceId, (repository) =>
      repository.updateAccountInvitationTemplate({
        instanceId: actor.instanceId,
        expectedRevision: parsed.data.expectedRevision,
        template: invitationSource(parsed.data),
        actorId: actor.actorAccountId,
      })
    );
    if (!updated) {
      return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', requestId);
    }
    try {
      await synchronizeMailTemplate(actor.instanceId, 'invitation', actor.actorAccountId);
    } catch {
      /* Source committed; GET reports pending. */
    }
    const view = await readView(actor.instanceId);
    return view
      ? jsonResponse(200, asApiItem(view, requestId))
      : createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', requestId);
  } catch (error) {
    if (error instanceof AccountInvitationTemplateValidationError) {
      return createApiError(400, 'invalid_account_invitation_template', error.message, requestId);
    }
    if (isRevisionConflict(error, 'account_invitation_template_revision_conflict')) {
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
