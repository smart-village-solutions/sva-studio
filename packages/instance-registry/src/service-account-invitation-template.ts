import {
  compileAccountInvitationTemplate,
  DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
  validateAccountInvitationTemplate,
} from '@sva/core';

import type {
  AccountInvitationProjection,
  CompiledAccountInvitationTemplate,
  InstanceRegistryRecord,
} from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data-repositories';
import { createSdkLogger } from '@sva/server-runtime';
import type { UpdateInstanceInput } from './mutation-types.js';

const logger = createSdkLogger({ component: 'iam-instance-account-invitation', level: 'info' });

export type ReadAccountInvitationProjection = (input: {
  readonly instanceId: string;
  readonly authRealm: string;
  readonly expected: CompiledAccountInvitationTemplate;
}) => Promise<AccountInvitationProjection>;

export type ProjectAccountInvitationTemplate = (input: {
  readonly instanceId: string;
  readonly authRealm: string;
  readonly template: CompiledAccountInvitationTemplate | null;
}) => Promise<void>;

export const validateAccountInvitationTemplateMutation = (
  input: UpdateInstanceInput,
  existing: InstanceRegistryRecord
): void => {
  if (input.accountInvitationTemplate === undefined) return;
  const expectedRevision = input.accountInvitationTemplateRevision;
  if (expectedRevision === undefined) {
    throw new Error('account_invitation_template_revision_required');
  }
  if ((existing.accountInvitationTemplate?.revision ?? 0) !== expectedRevision) {
    throw new Error('account_invitation_template_revision_conflict');
  }
  if (input.accountInvitationTemplate) {
    validateAccountInvitationTemplate(input.accountInvitationTemplate);
  }
};

export const applyAccountInvitationTemplateMutation = async (input: {
  readonly repository: Pick<InstanceRegistryRepository, 'updateAccountInvitationTemplate'>;
  readonly project?: ProjectAccountInvitationTemplate;
  readonly mutation: UpdateInstanceInput;
  readonly existing: InstanceRegistryRecord;
  readonly updated: InstanceRegistryRecord;
}): Promise<boolean> => {
  const template = input.mutation.accountInvitationTemplate;
  if (template === undefined) return true;
  const expectedRevision = input.mutation.accountInvitationTemplateRevision;
  if (expectedRevision === undefined) {
    throw new Error('account_invitation_template_revision_required');
  }

  if (template === null) {
    if (!input.project) throw new Error('keycloak_unavailable');
    const reserved = await input.repository.updateAccountInvitationTemplate({
      instanceId: input.updated.instanceId,
      expectedRevision,
      template: {
        ...(input.existing.accountInvitationTemplate ?? DEFAULT_ACCOUNT_INVITATION_TEMPLATE),
        revision: expectedRevision + 1,
      },
      actorId: input.mutation.actorId,
    });
    if (!reserved) return false;
    await input.project({
      instanceId: input.updated.instanceId,
      authRealm: input.updated.authRealm,
      template: null,
    });
    return Boolean(
      await input.repository.updateAccountInvitationTemplate({
        instanceId: input.updated.instanceId,
        expectedRevision: expectedRevision + 1,
        template: null,
        actorId: input.mutation.actorId,
      })
    );
  }

  const storedTemplate = { ...template, revision: expectedRevision + 1 };
  const persisted = await input.repository.updateAccountInvitationTemplate({
    instanceId: input.updated.instanceId,
    expectedRevision,
    template: storedTemplate,
    actorId: input.mutation.actorId,
  });
  if (!persisted) return false;
  try {
    await input.project?.({
      instanceId: persisted.instanceId,
      authRealm: persisted.authRealm,
      template: compileAccountInvitationTemplate({
        template: storedTemplate,
        tenantName: persisted.displayName,
        tenantHomepageUrl: `https://${persisted.primaryHostname}/`,
      }),
    });
  } catch (error) {
    logger.warn('account_invitation_template_projection_failed', {
      operation: 'update_account_invitation_template',
      instance_id: persisted.instanceId,
      revision: storedTemplate.revision,
      request_id: input.mutation.requestId,
      error_type: error instanceof Error ? error.name : typeof error,
    });
  }
  return true;
};
