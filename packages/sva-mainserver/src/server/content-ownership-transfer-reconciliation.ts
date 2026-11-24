import {
  hasUnresolvedMainserverOwnershipTransfer,
  loadMainserverMutationJournal,
  resolveActorInfo,
  withMainserverContentOwnershipLock,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import { errorJson, isResponse, json, withMutationNotApplied } from './content-route-core.js';
import { readActingPrincipalType } from './content-route-context.js';
import type { SupportedContentOwnershipRouteMatch } from './content-ownership-route-contract.js';
import { ownershipRouteFailureResponse } from './content-ownership-route-failure.js';
import type { MainserverMutationActor } from './mutation-principal.js';

const logger = createSdkLogger({
  component: 'sva-mainserver-ownership-transfer-reconciliation',
  level: 'info',
});

export type MainserverOwnershipTransferReconciler = (input: {
  readonly instanceId: string;
  readonly contentType: SupportedContentOwnershipRouteMatch['contentType'];
  readonly contentId: string;
  readonly providerEntityId: string;
  readonly currentDataProviderId: string;
}) => Promise<void>;

export const reconcileOrBlockOwnershipTransfer = async (input: {
  readonly actor: MainserverMutationActor;
  readonly contentType: SupportedContentOwnershipRouteMatch['contentType'];
  readonly contentId: string;
  readonly providerEntityId: string;
  readonly currentDataProviderId: string;
  readonly currentOperationExternalId: string;
  readonly reconcilePreviousTransfer?: MainserverOwnershipTransferReconciler;
}): Promise<Response | null> => {
  try {
    await input.reconcilePreviousTransfer?.({
      instanceId: input.actor.instanceId,
      contentType: input.contentType,
      contentId: input.contentId,
      providerEntityId: input.providerEntityId,
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
  });
  if (!blocked) return null;
  return errorJson(
    409,
    'content_transfer_reconciliation_required',
    'Ein früherer Transfer muss zuerst abgeglichen werden.'
  );
};

export const runUnstartedOwnershipTransfer = async (
  actor: MainserverMutationActor,
  route: SupportedContentOwnershipRouteMatch,
  execute: () => Promise<Response>
): Promise<Response> => {
  let journalChecked = false;
  try {
    return await withMainserverContentOwnershipLock({
      instanceId: actor.instanceId,
      contentType: route.contentType,
      contentId: route.contentId,
      execute: async () => {
        const previousOperation = await loadMainserverMutationJournal({
          instanceId: actor.instanceId,
          operationExternalId: actor.operationExternalId,
        });
        journalChecked = true;
        if (previousOperation) {
          return errorJson(
            409,
            'content_transfer_operation_already_started',
            'Diese Übertragung wurde bereits gestartet.'
          );
        }
        return execute();
      },
    });
  } catch (error) {
    if (journalChecked) throw error;
    return withMutationNotApplied(
      ownershipRouteFailureResponse(error, actor, route, 'Die Inhaberübertragung ist fehlgeschlagen.')
    );
  }
};

export const readTransferOperation = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  operationId: string
): Promise<Response> => {
  const principal = readActingPrincipalType(request);
  if (isResponse(principal)) return principal;
  if (!principal)
    return errorJson(400, 'acting_principal_type_required', 'Mutationsprincipal erforderlich.');
  const actor = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actor) return actor.error;
  const { actorAccountId, instanceId } = actor.actor;
  if (!actorAccountId || instanceId !== ctx.user.instanceId) {
    return errorJson(403, 'forbidden', 'Keine Berechtigung für diese Inhaltsoperation.');
  }
  const entry = await loadMainserverMutationJournal({
    instanceId,
    operationExternalId: operationId,
    readScope: {
      actorAccountId,
      activeOrganizationId: ctx.activeOrganizationId ?? null,
      actingPrincipalType: principal,
    },
  }).catch(() => null);
  if (entry === null)
    return errorJson(503, 'database_unavailable', 'Transferstatus nicht verfügbar.');
  if (entry?.actionId !== 'content.transferOwnership') {
    return errorJson(404, 'operation_not_found', 'Übertragung nicht gefunden.');
  }
  return json({
    data: {
      providerOutcome: entry.providerOutcome,
      reconciliationStatus: entry.reconciliationStatus,
    },
  });
};
