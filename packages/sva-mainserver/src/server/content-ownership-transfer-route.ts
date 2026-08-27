import {
  hasUnresolvedMainserverOwnershipTransfer,
  resolveMainserverOwnershipSource,
  resolveMainserverOwnershipTarget,
  validateCsrf,
  withMainserverContentOwnershipLock,
  type ResolvedMainserverOwnershipTarget,
} from '@sva/auth-runtime/server';
import { isUuid, type IamContentOwnerPrincipal } from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverOwnershipTransferContent } from '../types.js';
import { errorJson, isRecord, isResponse, json } from './content-route-core.js';
import {
  loadOwnershipItem,
  matchesOwnershipContentType,
  type OwnershipTransferAudit,
  type SupportedContentOwnershipRouteMatch,
} from './content-ownership-route-contract.js';
import { recordOwnershipTransferOutcome } from './content-ownership-telemetry.js';
import { executeWithCurrentTargetBinding } from './content-ownership-target-transfer.js';
import { SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  type MainserverMutationActor,
} from './mutation-principal.js';
import { transferSvaMainserverContentOwnership } from './service.js';

const parseTargetPrincipal = async (
  request: Request
): Promise<IamContentOwnerPrincipal | Response> => {
  const body = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(body) || Object.keys(body).some((key) => key !== 'targetPrincipal')) {
    return errorJson(400, 'invalid_request', 'Transferdaten müssen typisiert gesendet werden.');
  }
  const target = body.targetPrincipal;
  if (
    !isRecord(target) ||
    Object.keys(target).some((key) => key !== 'type' && key !== 'id') ||
    (target.type !== 'account' && target.type !== 'organization') ||
    typeof target.id !== 'string' ||
    !isUuid(target.id)
  ) {
    return errorJson(400, 'content_transfer_target_invalid', 'Der Zielinhaber ist ungültig.');
  }
  return { type: target.type, id: target.id };
};

const targetErrorResponse = (
  resolution: Exclude<Awaited<ReturnType<typeof resolveMainserverOwnershipTarget>>, { ok: true }>
): Response => {
  if (resolution.code === 'content_transfer_target_invalid') {
    return errorJson(400, resolution.code, 'Der Zielinhaber ist nicht aktiv oder ungültig.');
  }
  if (resolution.code === 'content_transfer_target_credentials_missing') {
    return errorJson(409, resolution.code, 'Für den Zielinhaber fehlen Mainserver-Credentials.');
  }
  if (
    resolution.code === 'content_transfer_target_binding_missing' ||
    resolution.code === 'content_transfer_target_binding_conflict'
  ) {
    return errorJson(409, resolution.code, 'Die DataProvider-Zuordnung ist nicht eindeutig.');
  }
  return errorJson(503, resolution.code, 'Der Zielinhaber konnte nicht verifiziert werden.');
};

const verifyTransferResult = async (input: {
  actor: MainserverMutationActor;
  sourceConnection: ResolvedMainserverOwnershipTarget['connection'];
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
    const sourceItem = await loadOwnershipItem(input.sourceConnection, input.content);
    if (sourceItem.dataProvider?.id === input.sourceDataProviderId) return 'source';
  } catch {
    // Neither credential context produced conclusive evidence.
  }
  return 'unclear';
};

const finalizeUnclearTransfer = async (input: {
  actor: MainserverMutationActor;
  sourceConnection: ResolvedMainserverOwnershipTarget['connection'];
  route: SupportedContentOwnershipRouteMatch;
  content: SvaMainserverOwnershipTransferContent;
  sourceDataProviderId: string;
  target: ResolvedMainserverOwnershipTarget;
  ownershipTransfer: OwnershipTransferAudit;
  error: unknown;
}): Promise<Response | null> => {
  const evidence = await verifyTransferResult(input);
  if (evidence === 'target') {
    await finalizeMainserverMutation({
      actor: input.actor,
      providerOutcome: 'succeeded',
      reconciliationStatus: 'complete',
      completedSteps: ['target_reread_confirmed'],
      contentId: input.route.contentId,
      observedDataProviderId: input.target.dataProviderId,
      ownershipTransfer: input.ownershipTransfer,
    });
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
      completedSteps: ['source_reread_confirmed'],
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
    completedSteps: ['target_reread', 'source_reread'],
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
  sourceConnection: ResolvedMainserverOwnershipTarget['connection'];
  route: SupportedContentOwnershipRouteMatch;
  content: SvaMainserverOwnershipTransferContent;
  sourceDataProviderId: string;
  target: ResolvedMainserverOwnershipTarget;
  ownershipTransfer: OwnershipTransferAudit;
}): Promise<Response | null> => {
  try {
    await transferSvaMainserverContentOwnership({
      ...input.sourceConnection,
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
      reconciliationStatus: 'complete',
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
}): Promise<Response> => {
  if (
    await hasUnresolvedMainserverOwnershipTransfer({
      instanceId: input.actor.instanceId,
      contentType: input.route.contentType,
      contentId: input.route.contentId,
    })
  ) {
    return errorJson(
      409,
      'content_transfer_reconciliation_required',
      'Ein früherer Transfer muss zuerst abgeglichen werden.'
    );
  }
  const actorVisibleCurrent = await loadOwnershipItem(input.actor, input.content);
  if (!matchesOwnershipContentType(input.route.contentType, actorVisibleCurrent)) {
    return errorJson(404, 'not_found', 'Inhalt wurde nicht gefunden.');
  }
  const initialDataProviderId = actorVisibleCurrent.dataProvider?.id?.trim();
  if (!initialDataProviderId)
    return errorJson(
      409,
      'content_transfer_source_changed',
      'Der aktuelle Inhaber ist nicht eindeutig.'
    );
  const source = await resolveMainserverOwnershipSource({
    instanceId: input.actor.instanceId,
    dataProviderId: initialDataProviderId,
  });
  if (!source)
    return errorJson(
      409,
      'content_transfer_source_changed',
      'Die aktive Principal-Bindung ist nicht eindeutig.'
    );
  const sourceResolution = await resolveMainserverOwnershipTarget({
    instanceId: input.actor.instanceId,
    actorKeycloakSubject: input.actor.keycloakSubject,
    principal: source.principal,
  });
  if (!sourceResolution.ok || sourceResolution.target.dataProviderId !== initialDataProviderId) {
    return errorJson(
      409,
      'content_transfer_source_changed',
      'Die Credentials des aktuellen Inhabers sind nicht eindeutig.'
    );
  }
  const current = await loadOwnershipItem(sourceResolution.target.connection, input.content);
  if (!matchesOwnershipContentType(input.route.contentType, current)) {
    return errorJson(404, 'not_found', 'Inhalt wurde nicht gefunden.');
  }
  const sourceDataProviderId = current.dataProvider?.id?.trim();
  if (!sourceDataProviderId || sourceDataProviderId !== initialDataProviderId)
    return errorJson(
      409,
      'content_transfer_source_changed',
      'Der aktuelle Inhaber ist nicht eindeutig.'
    );
  const authorization = await authorizeMainserverExistingContent({
    actor: input.actor,
    action: 'content.transferOwnership',
    contentType: input.route.contentType,
    contentId: input.route.contentId,
    item: current,
  });
  if (isResponse(authorization)) {
    recordOwnershipTransferOutcome({
      actor: input.actor,
      contentType: input.route.contentType,
      outcome: 'denied',
      errorCode: 'content_transfer_permission_missing',
    });
    return authorization;
  }
  const targetResolution = await resolveMainserverOwnershipTarget({
    instanceId: input.actor.instanceId,
    actorKeycloakSubject: input.actor.keycloakSubject,
    principal: input.principal,
  });
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
    return targetErrorResponse(targetResolution);
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
    sourcePrincipalType: source.principal.type,
    sourcePrincipalId: source.principal.id,
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
        sourceConnection: sourceResolution.target.connection,
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
      contentId: input.route.contentId,
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
  response.headers.set('x-sva-mainserver-entity-id', input.route.contentId);
  return response;
};

export const handleContentOwnershipTransfer = async (
  request: Request,
  route: SupportedContentOwnershipRouteMatch,
  actor: MainserverMutationActor,
  content: SvaMainserverOwnershipTransferContent
): Promise<Response> => {
  const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
  if (csrfError) return csrfError;
  const principal = await parseTargetPrincipal(request);
  if (isResponse(principal)) return principal;
  return withMainserverContentOwnershipLock({
    instanceId: actor.instanceId,
    contentType: route.contentType,
    contentId: route.contentId,
    execute: () => executeLockedTransfer({ actor, route, content, principal }),
  });
};
