import {
  resolveMainserverOwnershipSource,
  resolveMainserverOwnershipTarget,
  type ResolvedMainserverOwnershipTarget,
} from '@sva/auth-runtime/server';
import { isUuid, type IamContentOwnerPrincipal } from '@sva/core';

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
      principal: IamContentOwnerPrincipal;
      connection: ResolvedMainserverOwnershipTarget['connection'];
      dataProviderId: string;
    }>
  | Readonly<{ ok: false; response: Response }>;

export const resolveAuthorizedTransferSource = async (input: {
  actor: MainserverMutationActor;
  route: SupportedContentOwnershipRouteMatch;
  content: SvaMainserverOwnershipTransferContent;
}): Promise<SourceResolution> => {
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
  const source = await resolveMainserverOwnershipSource({
    instanceId: input.actor.instanceId,
    dataProviderId: initialDataProviderId,
  });
  if (!source) {
    return {
      ok: false,
      response: errorJson(
        409,
        'content_transfer_source_changed',
        'Die aktive Principal-Bindung ist nicht eindeutig.'
      ),
    };
  }
  const sourceResolution = await resolveMainserverOwnershipTarget({
    instanceId: input.actor.instanceId,
    actorKeycloakSubject: input.actor.keycloakSubject,
    principal: source.principal,
  });
  if (!sourceResolution.ok || sourceResolution.target.dataProviderId !== initialDataProviderId) {
    return {
      ok: false,
      response: errorJson(
        409,
        'content_transfer_source_changed',
        'Die Credentials des aktuellen Inhabers sind nicht eindeutig.'
      ),
    };
  }
  const current = await loadOwnershipItem(sourceResolution.target.connection, input.content);
  if (!matchesOwnershipContentType(input.route.contentType, current)) {
    return { ok: false, response: errorJson(404, 'not_found', 'Inhalt wurde nicht gefunden.') };
  }
  const sourceDataProviderId = current.dataProvider?.id?.trim();
  if (!sourceDataProviderId || sourceDataProviderId !== initialDataProviderId) {
    return {
      ok: false,
      response: errorJson(
        409,
        'content_transfer_source_changed',
        'Der aktuelle Inhaber ist nicht eindeutig.'
      ),
    };
  }
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
    return { ok: false, response: authorization };
  }
  return {
    ok: true,
    principal: source.principal,
    connection: sourceResolution.target.connection,
    dataProviderId: sourceDataProviderId,
  };
};
