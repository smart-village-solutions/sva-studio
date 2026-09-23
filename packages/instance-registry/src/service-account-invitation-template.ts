import {
  toServerAccountInvitationTemplateView,
  validateAccountInvitationTemplate,
} from '@sva/core';

import type { InstanceRegistryRecord } from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type { UpdateInstanceInput } from './mutation-types.js';
import { instanceRegistryServiceLogger } from './service-shared.js';

export const getServerAccountInvitationTemplate = async (
  repository: Pick<InstanceRegistryRepository, 'getServerAccountInvitationTemplate'>
) => toServerAccountInvitationTemplateView(await repository.getServerAccountInvitationTemplate());

export const updateServerAccountInvitationTemplate = async (input: {
  readonly repository: Pick<InstanceRegistryRepository, 'updateServerAccountInvitationTemplate'>;
  readonly expectedRevision: number;
  readonly template: Omit<import('@sva/core').AccountInvitationTemplate, 'revision'> | null;
  readonly actorId?: string;
  readonly requestId?: string;
}) => {
  if (input.template) validateAccountInvitationTemplate(input.template);
  const nextRevision = input.expectedRevision + 1;
  try {
    const state = await input.repository.updateServerAccountInvitationTemplate({
      expectedRevision: input.expectedRevision,
      template: input.template ? { ...input.template, revision: nextRevision } : null,
      actorId: input.actorId,
    });
    instanceRegistryServiceLogger.info('Server account invitation template updated', {
      operation: 'update_server_account_invitation_template',
      template_key: 'account_invitation',
      revision: state.revision,
      result: 'success',
      actor_id: input.actorId,
      request_id: input.requestId,
    });
    return toServerAccountInvitationTemplateView(state);
  } catch (error) {
    instanceRegistryServiceLogger.warn('Server account invitation template update failed', {
      operation: 'update_server_account_invitation_template',
      template_key: 'account_invitation',
      revision: nextRevision,
      result: 'failure',
      error_code:
        error instanceof Error && error.message === 'account_invitation_template_revision_conflict'
          ? error.message
          : error instanceof Error
            ? error.name
            : 'unknown_error',
      actor_id: input.actorId,
      request_id: input.requestId,
    });
    throw error;
  }
};

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
  readonly mutation: UpdateInstanceInput;
  readonly updated: InstanceRegistryRecord;
}): Promise<boolean> => {
  const template = input.mutation.accountInvitationTemplate;
  if (template === undefined) return true;
  const expectedRevision = input.mutation.accountInvitationTemplateRevision;
  if (expectedRevision === undefined) {
    throw new Error('account_invitation_template_revision_required');
  }

  return Boolean(
    await input.repository.updateAccountInvitationTemplate({
      instanceId: input.updated.instanceId,
      expectedRevision,
      template: template ? { ...template, revision: expectedRevision + 1 } : null,
      actorId: input.mutation.actorId,
    })
  );
};
