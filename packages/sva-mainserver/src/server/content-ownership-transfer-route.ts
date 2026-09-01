import {
  validateCsrf,
  withMainserverContentOwnershipLock,
  type ResolvedMainserverOwnershipTarget,
} from '@sva/auth-runtime/server';
import type { IamContentOwnerPrincipal } from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverOwnershipTransferContent } from '../types.js';
import { errorJson, isResponse, json } from './content-route-core.js';
import {
  loadOwnershipItem,
  type OwnershipTransferAudit,
  type SupportedContentOwnershipRouteMatch,
} from './content-ownership-route-contract.js';
import { recordOwnershipTransferOutcome } from './content-ownership-telemetry.js';
import { executeWithCurrentTargetBinding } from './content-ownership-target-transfer.js';
import {
  reconcileOrBlockOwnershipTransfer,
  type MainserverOwnershipTransferReconciler,
} from './content-ownership-transfer-reconciliation.js';
import { resolveTargetForMutation } from './content-ownership-target-verification.js';
import {
  ownershipTargetErrorResponse,
  parseOwnershipTargetPrincipal,
  authorizeObservedTransferSource,
  observeTransferSource,
} from './content-ownership-transfer-source.js';
import { SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import { finalizeMainserverMutation, type MainserverMutationActor } from './mutation-principal.js';
import { transferSvaMainserverContentOwnership } from './service.js';

export type { MainserverOwnershipTransferReconciler } from './content-ownership-transfer-reconciliation.js';

const verifyTransferResult = async (input: {
  actor: MainserverMutationActor;
  content: SvaMainserverOwnershipTransferContent;
  sourceDataProviderId: string;
  target: ResolvedMainserverOwnershipTarget;
}): Promise<'source' | 'target' | 'unclear'> => {
  try {
    const targetItem = await loadOwnershipItem(input.target.connection, input.content);
    if (targetItem.dataProvider?.id === input.target.dataProviderId) return 'target';
  } catch {
    // The source read below provides the second independent observation.
  }
  try {
    const actorItem = await loadOwnershipItem(input.actor, input.content);
    if (actorItem.dataProvider?.id === input.sourceDataProviderId) return 'source';
  } catch {
    // Neither credential context produced conclusive evidence.
  }
  return 'unclear';
};

const finalizeUnclearTransfer = async (input: {
  actor: MainserverMutationActor;
  route: SupportedContentOwnershipRouteMatch;
  content: SvaMainserverOwnershipTransferContent;
  sourceDataProviderId: string;
  target: ResolvedMainserverOwnershipTarget;
  ownershipTransfer: OwnershipTransferAudit;
  error: unknown;
}): Promise<Response | null> => {
  const evidence = await verifyTransferResult(input);
  if (evidence === 'target') {
    try {
      await finalizeMainserverMutation({
        actor: input.actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'reconciliation_required',
        completedSteps: ['target_reread_confirmed'],
        contentId: input.route.contentId,
        observedDataProviderId: input.target.dataProviderId,
        ownershipTransfer: input.ownershipTransfer,
      });
    } catch {
      // The target reread conclusively confirmed success. Keep the pending journal
      // as the reconciliation barrier instead of turning success into a retryable error.
    }
    recordOwnershipTransferOutcome({
      actor: input.actor,
      contentType: input.route.contentType,
      outcome: 'success',
    });
    return null;
  }
  const errorCode =
    input.error instanceof SvaMainserverError
      ? input.error.code
      : 'content_transfer_provider_rejected';
  if (evidence === 'source') {
    await finalizeMainserverMutation({
      actor: input.actor,
      providerOutcome: 'failed',
      reconciliationStatus: 'complete',
      completedSteps: ['actor_reread_confirmed'],
      contentId: input.route.contentId,
      observedDataProviderId: input.sourceDataProviderId,
      lastErrorCode: errorCode,
      ownershipTransfer: input.ownershipTransfer,
    });
    recordOwnershipTransferOutcome({
      actor: input.actor,
      contentType: input.route.contentType,
      outcome: 'rejected',
      errorCode,
    });
    return toMainserverErrorResponse(
      input.error,
      'Der Mainserver hat die Übertragung nicht bestätigt.'
    );
  }
  await finalizeMainserverMutation({
    actor: input.actor,
    providerOutcome: 'unknown',
    reconciliationStatus: 'reconciliation_required',
    completedSteps: ['target_reread', 'actor_reread'],
    contentId: input.route.contentId,
    lastErrorCode: 'content_transfer_reconciliation_required',
    ownershipTransfer: input.ownershipTransfer,
  });
  recordOwnershipTransferOutcome({
    actor: input.actor,
    contentType: input.route.contentType,
    outcome: 'reconciliation_required',
    errorCode: 'content_transfer_reconciliation_required',
  });
  return errorJson(
    409,
    'content_transfer_reconciliation_required',
    'Der Transfer muss abgeglichen werden.'
  );
};

const executeProviderTransfer = async (input: {
  actor: MainserverMutationActor;
  route: SupportedContentOwnershipRouteMatch;
  content: SvaMainserverOwnershipTransferContent;
  sourceDataProviderId: string;
  target: ResolvedMainserverOwnershipTarget;
  ownershipTransfer: OwnershipTransferAudit;
}): Promise<Response | null> => {
  try {
    await transferSvaMainserverContentOwnership({
      ...input.actor,
      content: input.content,
      expectedSourceDataProviderId: input.sourceDataProviderId,
      targetDataProviderId: input.target.dataProviderId,
    });
  } catch (error) {
    return finalizeUnclearTransfer({ ...input, error });
  }
  try {
    await finalizeMainserverMutation({
      actor: input.actor,
      providerOutcome: 'succeeded',
      reconciliationStatus: 'reconciliation_required',
      completedSteps: ['provider_write', 'target_provider_confirmed'],
      contentId: input.route.contentId,
      observedDataProviderId: input.target.dataProviderId,
      ownershipTransfer: input.ownershipTransfer,
    });
  } catch {
    // The provider response already confirmed the target. The still-pending journal
    // blocks another transfer until the local finalization can be reconciled.
  }
  recordOwnershipTransferOutcome({
    actor: input.actor,
    contentType: input.route.contentType,
    outcome: 'success',
  });
  return null;
};

const executeLockedTransfer = async (input: {
  actor: MainserverMutationActor;
  route: SupportedContentOwnershipRouteMatch;
  content: SvaMainserverOwnershipTransferContent;
  principal: IamContentOwnerPrincipal;
  reconcilePreviousTransfer?: MainserverOwnershipTransferReconciler;
}): Promise<Response> => {
  const observation = await observeTransferSource(input);
  if (!observation.ok) return observation.response;
  const sourceDataProviderId = observation.dataProviderId;
  const reconciliationBlock = await reconcileOrBlockOwnershipTransfer({
    actor: input.actor,
    contentType: input.route.contentType,
    contentId: input.route.contentId,
    currentDataProviderId: sourceDataProviderId,
    currentOperationExternalId: input.actor.operationExternalId,
    ...(input.reconcilePreviousTransfer
      ? { reconcilePreviousTransfer: input.reconcilePreviousTransfer }
      : {}),
  });
  if (reconciliationBlock) return reconciliationBlock;
  const source = await authorizeObservedTransferSource({
    actor: input.actor,
    route: input.route,
    observation,
  });
  if (!source.ok) return source.response;
  const targetResolution = await resolveTargetForMutation({
    actor: input.actor,
    contentType: input.route.contentType,
    contentId: input.route.contentId,
    principal: input.principal,
    sourceDataProviderId,
  });
  if (isResponse(targetResolution)) return targetResolution;
  if (!targetResolution.ok) {
    recordOwnershipTransferOutcome({
      actor: input.actor,
      contentType: input.route.contentType,
      outcome: 'rejected',
      errorCode: targetResolution.code,
    });
    await finalizeMainserverMutation({
      actor: input.actor,
      providerOutcome: 'failed',
      reconciliationStatus: 'complete',
      completedSteps: ['target_validation_rejected'],
      contentId: input.route.contentId,
      observedDataProviderId: sourceDataProviderId,
      lastErrorCode: targetResolution.code,
    });
    return ownershipTargetErrorResponse(targetResolution);
  }
  if (targetResolution.target.dataProviderId === sourceDataProviderId) {
    await finalizeMainserverMutation({
      actor: input.actor,
      providerOutcome: 'failed',
      reconciliationStatus: 'complete',
      completedSteps: ['target_validation_rejected'],
      contentId: input.route.contentId,
      observedDataProviderId: sourceDataProviderId,
      lastErrorCode: 'content_transfer_target_invalid',
    });
    return errorJson(
      409,
      'content_transfer_target_invalid',
      'Der Zielinhaber ist bereits zugeordnet.'
    );
  }
  const ownershipTransfer: OwnershipTransferAudit = {
    coverage: 'studio_mutations',
    sourcePrincipalResolution: source.principalResolution,
    ...(source.principal
      ? {
          sourcePrincipalType: source.principal.type,
          sourcePrincipalId: source.principal.id,
        }
      : {}),
    targetPrincipalType: input.principal.type,
    targetPrincipalId: input.principal.id,
    sourceDataProviderId,
    targetDataProviderId: targetResolution.target.dataProviderId,
    targetBindingVersion: targetResolution.target.bindingVersion,
  };
  const failure = await executeWithCurrentTargetBinding({
    actor: input.actor,
    target: targetResolution.target,
    ownershipTransfer,
    execute: () =>
      executeProviderTransfer({
        actor: input.actor,
        route: input.route,
        content: input.content,
        sourceDataProviderId,
        target: targetResolution.target,
        ownershipTransfer,
      }),
  });
  if (failure) return failure;
  const response = json({
    data: {
      contentId: input.content.id,
      contentType: input.route.contentType,
      sourceDataProviderId,
      targetPrincipal: input.principal,
      targetDataProvider: {
        id: targetResolution.target.dataProviderId,
        ...(targetResolution.target.dataProviderName
          ? { name: targetResolution.target.dataProviderName }
          : {}),
      },
      bindingVersion: targetResolution.target.bindingVersion,
    },
  });
  response.headers.set('x-sva-mainserver-entity-id', input.content.id);
  return response;
};

export const handleContentOwnershipTransfer = async (
  request: Request,
  route: SupportedContentOwnershipRouteMatch,
  actor: MainserverMutationActor,
  content: SvaMainserverOwnershipTransferContent,
  reconcilePreviousTransfer?: MainserverOwnershipTransferReconciler
): Promise<Response> => {
  const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
  if (csrfError) return csrfError;
  const principal = await parseOwnershipTargetPrincipal(request);
  if (isResponse(principal)) return principal;
  return withMainserverContentOwnershipLock({
    instanceId: actor.instanceId,
    contentType: route.contentType,
    contentId: route.contentId,
    execute: () =>
      executeLockedTransfer({
        actor,
        route,
        content,
        principal,
        ...(reconcilePreviousTransfer ? { reconcilePreviousTransfer } : {}),
      }),
  });
};
