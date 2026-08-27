import {
  annotateMainserverMutationJournal,
  type ResolvedMainserverOwnershipTarget,
} from '@sva/auth-runtime/server';

import { errorJson } from './content-route-core.js';
import { executeWithMainserverOwnershipBindingLocks } from './content-ownership-binding-locks.js';
import type { OwnershipTransferAudit } from './content-ownership-route-contract.js';
import { finalizeMainserverMutation, type MainserverMutationActor } from './mutation-principal.js';

export const executeWithCurrentTargetBinding = async (input: {
  readonly actor: MainserverMutationActor;
  readonly source: ResolvedMainserverOwnershipTarget;
  readonly target: ResolvedMainserverOwnershipTarget;
  readonly ownershipTransfer: OwnershipTransferAudit;
  readonly execute: () => Promise<Response | null>;
}): Promise<Response | null> => {
  try {
    return await executeWithMainserverOwnershipBindingLocks({
      actor: input.actor,
      bindings: [
        { role: 'source', target: input.source },
        { role: 'target', target: input.target },
      ],
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
    if (
      error instanceof Error &&
      (error.message === 'content_transfer_source_binding_changed' ||
        error.message === 'content_transfer_target_binding_conflict')
    ) {
      const sourceChanged = error.message === 'content_transfer_source_binding_changed';
      await finalizeMainserverMutation({
        actor: input.actor,
        providerOutcome: 'failed',
        reconciliationStatus: 'complete',
        completedSteps: [sourceChanged ? 'source_binding_rejected' : 'target_binding_rejected'],
        lastErrorCode: sourceChanged
          ? 'content_transfer_source_changed'
          : 'content_transfer_target_binding_conflict',
        ownershipTransfer: input.ownershipTransfer,
      });
      return errorJson(
        409,
        sourceChanged
          ? 'content_transfer_source_changed'
          : 'content_transfer_target_binding_conflict',
        sourceChanged
          ? 'Die DataProvider-Zuordnung des bisherigen Inhabers hat sich geändert.'
          : 'Die DataProvider-Zuordnung des Zielinhabers hat sich geändert.'
      );
    }
    throw error;
  }
};
