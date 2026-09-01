import { hasUnresolvedMainserverOwnershipTransfer } from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import type { SupportedContentOwnershipRouteMatch } from './content-ownership-route-contract.js';

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

export const hasBlockingOwnershipTransferReconciliation = async (input: {
  readonly instanceId: string;
  readonly contentType: SupportedContentOwnershipRouteMatch['contentType'];
  readonly contentId: string;
  readonly currentDataProviderId: string;
  readonly currentOperationExternalId: string;
  readonly reconcilePreviousTransfer?: MainserverOwnershipTransferReconciler;
}): Promise<boolean> => {
  try {
    await input.reconcilePreviousTransfer?.({
      instanceId: input.instanceId,
      contentType: input.contentType,
      contentId: input.contentId,
      currentDataProviderId: input.currentDataProviderId,
    });
  } catch (error) {
    logger.warn('Ownership transfer projection reconciliation failed', {
      operation: 'content_ownership_transfer_reconciliation',
      instance_id: input.instanceId,
      content_type: input.contentType,
      error_code:
        error instanceof Error && error.message.startsWith('content_transfer_')
          ? error.message
          : error instanceof Error
            ? error.name
            : 'unknown_error',
    });
  }
  return hasUnresolvedMainserverOwnershipTransfer({
    instanceId: input.instanceId,
    contentType: input.contentType,
    contentId: input.contentId,
    excludeOperationExternalId: input.currentOperationExternalId,
  });
};
