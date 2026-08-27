import {
  annotateMainserverMutationJournal,
  withMainserverOwnershipTargetBindingLock,
  type ResolvedMainserverOwnershipTarget,
} from '@sva/auth-runtime/server';

import { errorJson } from './content-route-core.js';
import type { OwnershipTransferAudit } from './content-ownership-route-contract.js';
import { finalizeMainserverMutation, type MainserverMutationActor } from './mutation-principal.js';

export const executeWithCurrentTargetBinding = async (input: {
  readonly actor: MainserverMutationActor;
  readonly target: ResolvedMainserverOwnershipTarget;
  readonly ownershipTransfer: OwnershipTransferAudit;
  readonly execute: () => Promise<Response | null>;
}): Promise<Response | null> => {
  try {
    return await withMainserverOwnershipTargetBindingLock({
      instanceId: input.actor.instanceId,
      target: input.target,
      execute: async () => {
        await annotateMainserverMutationJournal({
          instanceId: input.actor.instanceId,
          operationExternalId: input.actor.operationExternalId,
          expectedDataProviderId: input.target.dataProviderId,
          metadata: input.ownershipTransfer,
        });
        return input.execute();
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'content_transfer_target_binding_changed') {
      await finalizeMainserverMutation({
        actor: input.actor,
        providerOutcome: 'failed',
        reconciliationStatus: 'complete',
        completedSteps: ['target_binding_rejected'],
        lastErrorCode: 'content_transfer_target_binding_conflict',
        ownershipTransfer: input.ownershipTransfer,
      });
      return errorJson(
        409,
        'content_transfer_target_binding_conflict',
        'Die DataProvider-Zuordnung des Zielinhabers hat sich geändert.'
      );
    }
    throw error;
  }
};
