import {
  resolveMainserverOwnershipSource,
  resolveMainserverOwnershipTarget,
  type ResolvedMainserverOwnershipSource,
} from '@sva/auth-runtime/server';
import { isUuid, type IamContentOwnerPrincipal } from '@sva/core';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverOwnershipTransferContent } from '../types.js';
import { errorJson, isRecord, isResponse } from './content-route-core.js';
import {
  loadOwnershipItem,
  matchesOwnershipContentType,
  type SupportedContentOwnershipRouteMatch,
} from './content-ownership-route-contract.js';
import { recordOwnershipTransferOutcome } from './content-ownership-telemetry.js';
import {
  authorizeMainserverExistingContent,
  type MainserverMutationActor,
} from './mutation-principal.js';

const logger = createSdkLogger({
  component: 'sva-mainserver-content-ownership-route',
  level: 'info',
});

export type OwnershipSourceEnrichment =
  | Readonly<{ status: 'resolved'; source: ResolvedMainserverOwnershipSource }>
  | Readonly<{ status: 'unresolved' | 'failed' }>;

export const resolveOwnershipSourceEnrichment = async (input: {
  actor: MainserverMutationActor;
  contentType: string;
  contentId: string;
  dataProviderId: string;
  operation: 'authorization' | 'targets' | 'transfer';
}): Promise<OwnershipSourceEnrichment> => {
  try {
    const source = await resolveMainserverOwnershipSource({
      instanceId: input.actor.instanceId,
      dataProviderId: input.dataProviderId,
    });
    return source ? { status: 'resolved', source } : { status: 'unresolved' };
  } catch (error) {
    const context = getWorkspaceContext();
    logger.warn('Mainserver ownership source enrichment failed', {
      operation: 'mainserver_content_ownership_source_enrichment',
      request_id: context.requestId,
      trace_id: context.traceId,
      instance_id: input.actor.instanceId,
      content_type: input.contentType,
      content_id: input.contentId,
      data_provider_id: input.dataProviderId,
      route_operation: input.operation,
      error_message: error instanceof Error ? error.message : String(error),
    });
    return { status: 'failed' };
  }
};

const readAuthorizationErrorCode = async (response: Response): Promise<string> => {
  const payload = (await response
    .clone()
    .json()
    .catch(() => undefined)) as unknown;
  return isRecord(payload) && typeof payload.error === 'string'
    ? payload.error
    : 'content_transfer_authorization_failed';
};

export const parseOwnershipTargetPrincipal = async (
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

export const ownershipTargetErrorResponse = (
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

type SourceResolution =
  | Readonly<{
      ok: true;
      principal?: IamContentOwnerPrincipal;
      principalResolution: OwnershipSourceEnrichment['status'];
      dataProviderId: string;
    }>
  | Readonly<{ ok: false; response: Response }>;

type TransferSourceObservation =
  | Readonly<{
      ok: true;
      item: Awaited<ReturnType<typeof loadOwnershipItem>>;
      principal?: IamContentOwnerPrincipal;
      principalResolution: OwnershipSourceEnrichment['status'];
      dataProviderId: string;
    }>
  | Readonly<{ ok: false; response: Response }>;

export const observeTransferSource = async (input: {
  actor: MainserverMutationActor;
  route: SupportedContentOwnershipRouteMatch;
  content: SvaMainserverOwnershipTransferContent;
}): Promise<TransferSourceObservation> => {
  const actorVisibleCurrent = await loadOwnershipItem(input.actor, input.content);
  if (!matchesOwnershipContentType(input.route.contentType, actorVisibleCurrent)) {
    return { ok: false, response: errorJson(404, 'not_found', 'Inhalt wurde nicht gefunden.') };
  }
  const initialDataProviderId = actorVisibleCurrent.dataProvider?.id?.trim();
  if (!initialDataProviderId) {
    return {
      ok: false,
      response: errorJson(
        409,
        'content_transfer_source_changed',
        'Der aktuelle Inhaber ist nicht eindeutig.'
      ),
    };
  }
  const source = await resolveOwnershipSourceEnrichment({
    actor: input.actor,
    contentType: input.route.contentType,
    contentId: input.route.contentId,
    dataProviderId: initialDataProviderId,
    operation: 'transfer',
  });
  return {
    ok: true,
    item: actorVisibleCurrent,
    ...(source.status === 'resolved' ? { principal: source.source.principal } : {}),
    principalResolution: source.status,
    dataProviderId: initialDataProviderId,
  };
};

export const authorizeObservedTransferSource = async (input: {
  actor: MainserverMutationActor;
  route: SupportedContentOwnershipRouteMatch;
  observation: Extract<TransferSourceObservation, { ok: true }>;
}): Promise<SourceResolution> => {
  const authorization = await authorizeMainserverExistingContent({
    actor: input.actor,
    action: 'content.transferOwnership',
    contentType: input.route.contentType,
    contentId: input.route.contentId,
    item: input.observation.item,
    forceExactScopeAuthorization: true,
    ...(input.observation.principalResolution === 'resolved' ? {} : { requiredAccessScope: 'all' }),
  });
  if (isResponse(authorization)) {
    const errorCode = await readAuthorizationErrorCode(authorization);
    recordOwnershipTransferOutcome({
      actor: input.actor,
      contentType: input.route.contentType,
      outcome: authorization.status === 403 ? 'denied' : 'rejected',
      errorCode,
    });
    return { ok: false, response: authorization };
  }
  return {
    ok: true,
    ...(input.observation.principal ? { principal: input.observation.principal } : {}),
    principalResolution: input.observation.principalResolution,
    dataProviderId: input.observation.dataProviderId,
  };
};
