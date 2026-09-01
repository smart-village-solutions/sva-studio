import { hasUnresolvedMainserverOwnershipTransfer } from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import { errorJson } from './content-route-core.js';
import type { SupportedContentOwnershipRouteMatch } from './content-ownership-route-contract.js';
import { finalizeMainserverMutation, type MainserverMutationActor } from './mutation-principal.js';

const logger = createSdkLogger({
  component: 'sva-mainserver-ownership-transfer-reconciliation',
  level: 'info',
});

export type MainserverOwnershipTransferReconciler = (input: {
  readonly instanceId: string;
  readonly contentType: SupportedContentOwnershipRouteMatch['contentType'];
  readonly contentId: string;
  readonly currentDataProviderId: string;
}) => Promise<void>;

export const reconcileOrBlockOwnershipTransfer = async (input: {
  readonly actor: MainserverMutationActor;
  readonly contentType: SupportedContentOwnershipRouteMatch['contentType'];
  readonly contentId: string;
  readonly currentDataProviderId: string;
  readonly currentOperationExternalId: string;
  readonly reconcilePreviousTransfer?: MainserverOwnershipTransferReconciler;
}): Promise<Response | null> => {
  try {
    await input.reconcilePreviousTransfer?.({
      instanceId: input.actor.instanceId,
      contentType: input.contentType,
      contentId: input.contentId,
      currentDataProviderId: input.currentDataProviderId,
    });
  } catch (error) {
    logger.warn('Ownership transfer projection reconciliation failed', {
      operation: 'content_ownership_transfer_reconciliation',
      instance_id: input.actor.instanceId,
      content_type: input.contentType,
      content_id: input.contentId,
      current_data_provider_id: input.currentDataProviderId,
      operation_external_id: input.currentOperationExternalId,
      error_code:
        error instanceof Error && error.message.startsWith('content_transfer_')
          ? error.message
          : error instanceof Error
            ? error.name
            : 'unknown_error',
    });
  }
  const blocked = await hasUnresolvedMainserverOwnershipTransfer({
    instanceId: input.actor.instanceId,
    contentType: input.contentType,
    contentId: input.contentId,
    excludeOperationExternalId: input.currentOperationExternalId,
  });
  if (!blocked) return null;
  await finalizeMainserverMutation({
    actor: input.actor,
    providerOutcome: 'failed',
    reconciliationStatus: 'complete',
    completedSteps: ['previous_transfer_reconciliation_blocked'],
    contentId: input.contentId,
    observedDataProviderId: input.currentDataProviderId,
    lastErrorCode: 'content_transfer_reconciliation_required',
  });
  return errorJson(
    409,
    'content_transfer_reconciliation_required',
    'Ein früherer Transfer muss zuerst abgeglichen werden.'
  );
};
