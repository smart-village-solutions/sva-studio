import { emitAuthAuditEvent, finalizeMainserverMutationJournal } from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { MainserverMutationActor } from './mutation-principal-types.js';

const logger = createSdkLogger({ component: 'sva-mainserver-mutation-principal', level: 'info' });

export const finalizeMainserverMutation = async (input: {
  readonly actor: MainserverMutationActor;
  readonly providerOutcome: 'failed' | 'succeeded' | 'unknown';
  readonly reconciliationStatus: 'complete' | 'failed' | 'reconciliation_required';
  readonly completedSteps: readonly string[];
  readonly contentId?: string;
  readonly observedDataProviderId?: string;
  readonly lastErrorCode?: string;
}): Promise<void> => {
  const journal = await finalizeMainserverMutationJournal({
    instanceId: input.actor.instanceId,
    operationExternalId: input.actor.operationExternalId,
    providerOutcome: input.providerOutcome,
    reconciliationStatus: input.reconciliationStatus,
    completedSteps: input.completedSteps,
    contentId: input.contentId,
    observedDataProviderId: input.observedDataProviderId,
    lastErrorCode: input.lastErrorCode,
  });
  if (!journal?.actionId || !journal.contentType || !journal.authorizationMode) return;

  const succeeded = input.providerOutcome === 'succeeded';
  const actionNamespace = journal.actionId.split('.')[0] ?? 'content';
  const workspaceContext = getWorkspaceContext();
  try {
    await emitAuthAuditEvent({
      eventType: succeeded ? 'plugin_action_authorized' : 'plugin_action_failed',
      actorUserId: input.actor.keycloakSubject,
      scope: { kind: 'instance', instanceId: input.actor.instanceId },
      workspaceId: input.actor.instanceId,
      outcome: succeeded ? 'success' : 'failure',
      requestId: workspaceContext.requestId,
      traceId: workspaceContext.traceId,
      pluginAction: {
        actionId: journal.actionId,
        actionNamespace,
        actionOwner: 'sva-mainserver',
        result: succeeded ? 'success' : 'failure',
        reasonCode: succeeded
          ? 'mainserver_provider_succeeded'
          : (input.lastErrorCode ?? `mainserver_provider_${input.providerOutcome}`),
        resourceType: journal.contentType,
        resourceId: input.contentId ?? journal.contentId,
        mainserverMutation: {
          actingPrincipalType: input.actor.mutationPrincipalContext.actingPrincipalType,
          actingPrincipalId: input.actor.mutationPrincipalContext.actingPrincipalId,
          activeOrganizationId: input.actor.activeOrganizationId,
          credentialSource: input.actor.mutationPrincipalContext.credentialSource,
          credentialFingerprint: input.actor.mutationPrincipalContext.credentialFingerprint,
          dataProviderId: input.observedDataProviderId ?? journal.observedDataProviderId,
          authorizationMode: journal.authorizationMode,
          resolverMode: journal.resolverMode,
          candidateAuthorizationMode: journal.candidateAuthorizationMode,
          candidateAllowed: journal.candidateAllowed,
          shadowDifference: journal.shadowDifference,
          operationExternalId: input.actor.operationExternalId,
          providerOutcome: input.providerOutcome,
          reconciliationStatus: input.reconciliationStatus,
        },
      },
    });
  } catch (error) {
    logger.warn('Failed to emit Mainserver provider outcome audit', {
      operation: 'mainserver_provider_outcome_audit',
      instance_id: input.actor.instanceId,
      operation_external_id: input.actor.operationExternalId,
      action_id: journal.actionId,
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
};

const readMutationFailureCode = (error: unknown): string => {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.trim().length > 0
  ) {
    return error.code.trim();
  }
  return 'internal_error';
};

export const finalizeMainserverMutationFailure = async (input: {
  readonly actor: MainserverMutationActor;
  readonly error: unknown;
  readonly completedSteps?: readonly string[];
  readonly contentId?: string;
  readonly observedDataProviderId?: string;
}): Promise<void> => {
  const lastErrorCode = readMutationFailureCode(input.error);
  try {
    await finalizeMainserverMutation({
      actor: input.actor,
      providerOutcome: 'failed',
      reconciliationStatus: 'reconciliation_required',
      completedSteps: input.completedSteps ?? [],
      contentId: input.contentId,
      observedDataProviderId: input.observedDataProviderId,
      lastErrorCode,
    });
  } catch (journalError) {
    logger.warn('Failed to finalize Mainserver mutation failure', {
      operation: 'mainserver_mutation_failure_finalize',
      instance_id: input.actor.instanceId,
      operation_external_id: input.actor.operationExternalId,
      error_code: lastErrorCode,
      journal_error: journalError instanceof Error ? journalError.message : String(journalError),
    });
  }
};

export const runMainserverMutationWithFailureFinalization = async <T>(input: {
  readonly actor: MainserverMutationActor;
  readonly contentId?: string;
  readonly operation: () => Promise<T>;
}): Promise<T> => {
  try {
    return await input.operation();
  } catch (error) {
    await finalizeMainserverMutationFailure({
      actor: input.actor,
      error,
      contentId: input.contentId,
    });
    throw error;
  }
};
