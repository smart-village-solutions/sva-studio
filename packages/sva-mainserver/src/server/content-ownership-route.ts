import {
  listMainserverOwnershipTargets,
  resolveActorInfo,
  resolveMainserverOwnershipTarget,
  validateCsrf,
  withAuthenticatedUser,
  withMainserverContentOwnershipLock,
  type AuthenticatedRequestContext,
  type ResolvedMainserverOwnershipTarget,
} from '@sva/auth-runtime/server';
import { isUuid, type IamContentOwnerPrincipal } from '@sva/core';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type {
  SvaMainserverConnectionInput,
  SvaMainserverOwnershipTransferContent,
  SvaMainserverProjectionContentType,
} from '../types.js';
import { errorJson, isRecord, isResponse, json } from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  resolveMainserverMutationActor,
  resolveMainserverResourceAccess,
  type MainserverMutationActor,
} from './mutation-principal.js';
import {
  getSvaMainserverEvent,
  getSvaMainserverGenericItem,
  getSvaMainserverNews,
  getSvaMainserverPoi,
  transferSvaMainserverContentOwnership,
} from './service.js';

const routePrefix = '/api/v1/mainserver/content-ownership/';
const logger = createSdkLogger({
  component: 'sva-mainserver-content-ownership-route',
  level: 'info',
});

type SupportedContentType = Exclude<SvaMainserverProjectionContentType, 'surveys.survey'>;
type RouteMatch = Readonly<{
  contentType: SvaMainserverProjectionContentType;
  contentId: string;
  operation: 'targets' | 'transfer';
}>;

const supportedContentTypes = new Set<SvaMainserverProjectionContentType>([
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
  'generic-items.generic-item',
  'faq.faq',
  'cockpit-cards.cockpit-card',
  'projects.project',
  'surveys.survey',
]);

const isProjectionContentType = (value: string): value is SvaMainserverProjectionContentType =>
  supportedContentTypes.has(value as SvaMainserverProjectionContentType);

const matchRoute = (request: Request): RouteMatch | null => {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(routePrefix)) return null;
  const segments = pathname.slice(routePrefix.length).split('/');
  if (segments.length !== 3) return null;
  const [encodedContentType, encodedContentId, operation] = segments;
  let contentType: string;
  let contentId: string;
  try {
    contentType = decodeURIComponent(encodedContentType ?? '');
    contentId = decodeURIComponent(encodedContentId ?? '');
  } catch {
    return null;
  }
  return isProjectionContentType(contentType) &&
    contentId.length > 0 &&
    (operation === 'targets' || operation === 'transfer')
    ? { contentType, contentId, operation }
    : null;
};

const toTransferContent = (
  contentType: SupportedContentType,
  contentId: string
): SvaMainserverOwnershipTransferContent => {
  switch (contentType) {
    case 'news.article':
      return { type: 'news', id: contentId };
    case 'events.event-record':
      return { type: 'event', id: contentId };
    case 'poi.point-of-interest':
      return { type: 'poi', id: contentId };
    case 'generic-items.generic-item':
    case 'faq.faq':
    case 'cockpit-cards.cockpit-card':
    case 'projects.project':
      return { type: 'generic-item', id: contentId };
  }
};

const loadItem = async (
  connection: SvaMainserverConnectionInput,
  content: SvaMainserverOwnershipTransferContent
) => {
  switch (content.type) {
    case 'news':
      return getSvaMainserverNews({ ...connection, newsId: content.id });
    case 'event':
      return getSvaMainserverEvent({ ...connection, eventId: content.id });
    case 'poi':
      return getSvaMainserverPoi({ ...connection, poiId: content.id });
    case 'generic-item':
      return getSvaMainserverGenericItem({ ...connection, genericItemId: content.id });
  }
};

const resolveActor = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<MainserverMutationActor | Response> => {
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) return actorResolution.error;
  return resolveMainserverMutationActor({
    request,
    ctx,
    authorizedActor: {
      instanceId: actorResolution.actor.instanceId,
      keycloakSubject: ctx.user.id,
      ...(ctx.activeOrganizationId ? { activeOrganizationId: ctx.activeOrganizationId } : {}),
    },
  });
};

const parseTargetPrincipal = async (
  request: Request
): Promise<IamContentOwnerPrincipal | Response> => {
  const body = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(body) || Object.keys(body).some((key) => key !== 'targetPrincipal')) {
    return errorJson(
      400,
      'invalid_request',
      'Transferdaten müssen als typisiertes Objekt gesendet werden.'
    );
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
  switch (resolution.code) {
    case 'content_transfer_target_invalid':
      return errorJson(400, resolution.code, 'Der Zielinhaber ist nicht aktiv oder ungültig.');
    case 'content_transfer_target_credentials_missing':
      return errorJson(
        409,
        resolution.code,
        'Für den Zielinhaber fehlen verwendbare Mainserver-Credentials.'
      );
    case 'content_transfer_target_binding_missing':
    case 'content_transfer_target_binding_conflict':
      return errorJson(
        409,
        resolution.code,
        'Der Zielinhaber besitzt keine eindeutige aktuelle DataProvider-Zuordnung.'
      );
    case 'identity_provider_unavailable':
    case 'database_unavailable':
      return errorJson(503, resolution.code, 'Der Zielinhaber konnte nicht verifiziert werden.');
  }
};

const verifyAfterUnclearResult = async (input: {
  actor: MainserverMutationActor;
  content: SvaMainserverOwnershipTransferContent;
  sourceDataProviderId: string;
  target: ResolvedMainserverOwnershipTarget;
}): Promise<'source' | 'target' | 'unclear'> => {
  try {
    const targetItem = await loadItem(input.target.connection, input.content);
    if (targetItem.dataProvider?.id === input.target.dataProviderId) return 'target';
  } catch {
    // The source read below provides the second independent observation.
  }
  try {
    const sourceItem = await loadItem(input.actor, input.content);
    if (sourceItem.dataProvider?.id === input.sourceDataProviderId) return 'source';
  } catch {
    // Neither credential context produced conclusive evidence.
  }
  return 'unclear';
};

const handleTargets = async (
  request: Request,
  route: RouteMatch,
  actor: MainserverMutationActor,
  sourceDataProviderId: string
): Promise<Response> => {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') ?? 'account';
  if (type !== 'account' && type !== 'organization') {
    return errorJson(400, 'invalid_request', 'Zielinhabertyp ist ungültig.');
  }
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '10', 10) || 10)
  );
  const search = url.searchParams.get('q')?.trim() || undefined;
  const result = await listMainserverOwnershipTargets({
    instanceId: actor.instanceId,
    actorKeycloakSubject: actor.keycloakSubject,
    type,
    page,
    pageSize,
    ...(search ? { search } : {}),
    currentDataProviderId: sourceDataProviderId,
  });
  return json({
    data: result.items,
    pagination: { page: result.page, pageSize: result.pageSize, total: result.total },
    contentType: route.contentType,
  });
};

const handleTransfer = async (
  request: Request,
  route: RouteMatch,
  actor: MainserverMutationActor,
  content: SvaMainserverOwnershipTransferContent,
  sourceDataProviderId: string
): Promise<Response> => {
  const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
  if (csrfError) return csrfError;
  const principal = await parseTargetPrincipal(request);
  if (isResponse(principal)) return principal;

  return withMainserverContentOwnershipLock({
    instanceId: actor.instanceId,
    contentType: route.contentType,
    contentId: route.contentId,
    execute: async () => {
      const targetResolution = await resolveMainserverOwnershipTarget({
        instanceId: actor.instanceId,
        actorKeycloakSubject: actor.keycloakSubject,
        principal,
      });
      if (!targetResolution.ok) return targetErrorResponse(targetResolution);
      if (targetResolution.target.dataProviderId === sourceDataProviderId) {
        return errorJson(
          409,
          'content_transfer_target_invalid',
          'Der Zielinhaber ist bereits zugeordnet.'
        );
      }

      try {
        await transferSvaMainserverContentOwnership({
          ...actor,
          content,
          expectedSourceDataProviderId: sourceDataProviderId,
          targetDataProviderId: targetResolution.target.dataProviderId,
        });
        await finalizeMainserverMutation({
          actor,
          providerOutcome: 'succeeded',
          reconciliationStatus: 'complete',
          completedSteps: ['provider_write', 'target_provider_confirmed'],
          contentId: route.contentId,
          observedDataProviderId: targetResolution.target.dataProviderId,
        });
      } catch (error) {
        const evidence = await verifyAfterUnclearResult({
          actor,
          content,
          sourceDataProviderId,
          target: targetResolution.target,
        });
        if (evidence === 'target') {
          await finalizeMainserverMutation({
            actor,
            providerOutcome: 'succeeded',
            reconciliationStatus: 'complete',
            completedSteps: ['target_reread_confirmed'],
            contentId: route.contentId,
            observedDataProviderId: targetResolution.target.dataProviderId,
          });
        } else if (evidence === 'source') {
          await finalizeMainserverMutation({
            actor,
            providerOutcome: 'failed',
            reconciliationStatus: 'complete',
            completedSteps: ['source_reread_confirmed'],
            contentId: route.contentId,
            observedDataProviderId: sourceDataProviderId,
            lastErrorCode:
              error instanceof SvaMainserverError
                ? error.code
                : 'content_transfer_provider_rejected',
          });
          return toMainserverErrorResponse(
            error,
            'Der Mainserver hat die Übertragung nicht bestätigt.'
          );
        } else {
          await finalizeMainserverMutation({
            actor,
            providerOutcome: 'unknown',
            reconciliationStatus: 'reconciliation_required',
            completedSteps: ['target_reread', 'source_reread'],
            contentId: route.contentId,
            lastErrorCode: 'content_transfer_reconciliation_required',
          });
          return errorJson(
            409,
            'content_transfer_reconciliation_required',
            'Der Ausgang der Übertragung muss abgeglichen werden.'
          );
        }
      }

      const response = json({
        data: {
          contentId: route.contentId,
          contentType: route.contentType,
          sourceDataProviderId,
          targetPrincipal: principal,
          targetDataProvider: {
            id: targetResolution.target.dataProviderId,
            ...(targetResolution.target.dataProviderName
              ? { name: targetResolution.target.dataProviderName }
              : {}),
          },
          bindingVersion: targetResolution.target.bindingVersion,
        },
      });
      response.headers.set('x-sva-mainserver-entity-id', route.contentId);
      return response;
    },
  });
};

const dispatchAuthenticated = async (
  request: Request,
  route: RouteMatch,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  if (route.contentType === 'surveys.survey') {
    return errorJson(
      409,
      'content_transfer_type_unsupported',
      'Dieser Inhaltstyp unterstützt noch keine Übertragung.'
    );
  }
  const actor = await resolveActor(request, ctx);
  if (isResponse(actor)) return actor;
  const content = toTransferContent(route.contentType, route.contentId);

  try {
    const current = await loadItem(actor, content);
    const sourceDataProviderId = current.dataProvider?.id?.trim();
    if (!sourceDataProviderId) {
      return errorJson(
        409,
        'content_transfer_source_changed',
        'Der aktuelle Inhaber konnte nicht eindeutig gelesen werden.'
      );
    }
    if (route.operation === 'targets') {
      const access = await resolveMainserverResourceAccess({
        actor,
        actions: ['content.transferOwnership'],
        contentType: route.contentType,
        contentId: route.contentId,
        item: current,
      });
      return access['content.transferOwnership'] === true
        ? handleTargets(request, route, actor, sourceDataProviderId)
        : errorJson(
            403,
            'content_transfer_permission_missing',
            'Die Berechtigung zum Übertragen dieses Inhalts fehlt.'
          );
    }

    const authorization = await authorizeMainserverExistingContent({
      actor,
      action: 'content.transferOwnership',
      contentType: route.contentType,
      contentId: route.contentId,
      item: current,
    });
    if (isResponse(authorization)) return authorization;
    return handleTransfer(request, route, actor, content, sourceDataProviderId);
  } catch (error) {
    logger.warn('Mainserver content ownership route failed', {
      operation: 'mainserver_content_ownership',
      request_id: getWorkspaceContext().requestId,
      trace_id: getWorkspaceContext().traceId,
      instance_id: actor.instanceId,
      content_type: route.contentType,
      content_id: route.contentId,
      route_operation: route.operation,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
      error_message: error instanceof Error ? error.message : String(error),
    });
    return toMainserverErrorResponse(error, 'Die Inhaberübertragung ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverContentOwnershipRequest = async (
  request: Request
): Promise<Response | null> => {
  const route = matchRoute(request);
  if (!route) return null;
  if (
    (route.operation === 'targets' && request.method !== 'GET') ||
    (route.operation === 'transfer' && request.method !== 'POST')
  ) {
    return errorJson(405, 'method_not_allowed', 'HTTP-Methode wird nicht unterstützt.');
  }
  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, route, ctx));
};
