import { emitActivityLog, withInstanceScopedDb } from '../iam-account-management/shared.js';
import type { CreateLegalTextInput, UpdateLegalTextInput } from './repository-shared.js';

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

export type DeleteLegalTextInput = {
  instanceId: string;
  actorAccountId: string;
  requestId?: string;
  traceId?: string;
  legalTextVersionId: string;
};

export class LegalTextDeleteConflictError extends Error {
  constructor() {
    super('legal_text_acceptances_exist');
    this.name = 'LegalTextDeleteConflictError';
  }
}

export const emitLegalTextCreatedActivityLog = (
  client: InstanceScopedClient,
  input: CreateLegalTextInput,
  legalTextVersionId: string,
) =>
  emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    eventType: 'iam.legal_text.created',
    result: 'success',
    payload: { legal_text_version_id: legalTextVersionId, name: input.name, legal_text_version: input.legalTextVersion, locale: input.locale, status: input.status },
    requestId: input.requestId,
    traceId: input.traceId,
  });

export const emitLegalTextUpdatedActivityLog = (
  client: InstanceScopedClient,
  input: UpdateLegalTextInput,
  updatedLegalTextVersionId: string,
  updatedFields: readonly string[],
) =>
  emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    eventType: 'iam.legal_text.updated',
    result: 'success',
    payload: { legal_text_version_id: updatedLegalTextVersionId, updated_fields: updatedFields },
    requestId: input.requestId,
    traceId: input.traceId,
  });

export const emitLegalTextDeletedActivityLog = (
  client: InstanceScopedClient,
  input: DeleteLegalTextInput,
  deletedLegalTextVersionId: string,
) =>
  emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    eventType: 'iam.legal_text.deleted',
    result: 'success',
    payload: { legal_text_version_id: deletedLegalTextVersionId },
    requestId: input.requestId,
    traceId: input.traceId,
  });
