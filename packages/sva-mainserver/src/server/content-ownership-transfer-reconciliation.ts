import { hasUnresolvedMainserverOwnershipTransfer } from '@sva/auth-runtime/server';

import type { SupportedContentOwnershipRouteMatch } from './content-ownership-route-contract.js';

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
  readonly reconcilePreviousTransfer?: MainserverOwnershipTransferReconciler;
}): Promise<boolean> => {
  try {
    await input.reconcilePreviousTransfer?.({
      instanceId: input.instanceId,
      contentType: input.contentType,
      contentId: input.contentId,
      currentDataProviderId: input.currentDataProviderId,
    });
  } catch {
    // The unresolved journal remains the fail-closed barrier below.
  }
  return hasUnresolvedMainserverOwnershipTransfer(input);
};
