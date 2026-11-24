import {
  ContentOwnershipAccountSearchError,
  listMainserverOwnershipTargets,
  loadExternalContentReferenceByContentId,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
  type ResolvedMainserverOwnershipSource,
} from '@sva/auth-runtime/server';

import { errorJson, isResponse, json, withMutationNotApplied } from './content-route-core.js';
import { withMainserverContextBinding } from './content-route-context.js';
import { readTransferOperation } from './content-ownership-transfer-reconciliation.js';
import {
  loadOwnershipItem,
  matchContentOwnershipRoute,
  readTransferOperationId,
  matchesOwnershipContentType,
  resolveOwnershipRouteActor,
  toOwnershipTransferContent,
  type ContentOwnershipRouteMatch,
  type SupportedContentOwnershipRouteMatch,
} from './content-ownership-route-contract.js';
import {
  handleContentOwnershipTransfer,
  type MainserverOwnershipTransferReconciler,
} from './content-ownership-transfer-route.js';
import { ownershipRouteFailureResponse } from './content-ownership-route-failure.js';
import { SvaMainserverError } from './errors.js';
import { resolveOwnershipSourceEnrichment } from './content-ownership-transfer-source.js';
import {
  resolveMainserverResourceAccess,
  type MainserverMutationActor,
} from './mutation-principal.js';
import { projectSourceReferenceInput } from './projects-route-transport.js';
import { getSvaMainserverSurvey } from './service.js';

const MAX_OWNERSHIP_TARGET_SEARCH_LENGTH = 200;

const handleTargets = async (
  request: Request,
  route: ContentOwnershipRouteMatch,
  actor: MainserverMutationActor,
  source: Readonly<{
    dataProviderId: string;
    displayName: string;
    principal?: ResolvedMainserverOwnershipSource['principal'];
    principalResolution: 'resolved' | 'unresolved' | 'failed';
  }>
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
  if (search && search.length > MAX_OWNERSHIP_TARGET_SEARCH_LENGTH) {
    return errorJson(400, 'invalid_request', 'Der Suchbegriff ist zu lang.');
  }
  const result = await listMainserverOwnershipTargets({
    instanceId: actor.instanceId,
    actorKeycloakSubject: actor.keycloakSubject,
    type,
    page,
    pageSize,
    ...(search ? { search } : {}),
    ...(url.searchParams.get('selection') === 'batch'
      ? {}
      : {
          ...(source.principal ? { currentOwner: source.principal } : {}),
          currentDataProviderId: source.dataProviderId,
        }),
  });
  return json({
    data: result.items,
    pagination: { page: result.page, pageSize: result.pageSize, total: result.total },
    contentType: route.contentType,
    currentOwner: {
      ...(source.principal ? { principal: source.principal } : {}),
      principalResolution: source.principalResolution,
      displayName: source.displayName,
    },
  });
};

const handleAuthorizedTargets = async (
  request: Request,
  route: SupportedContentOwnershipRouteMatch,
  actor: MainserverMutationActor,
  content: ReturnType<typeof toOwnershipTransferContent>
): Promise<Response> => {
  const current = await loadOwnershipItem(actor, content);
  if (!matchesOwnershipContentType(route.contentType, current)) {
    return errorJson(404, 'not_found', 'Inhalt wurde nicht gefunden.');
  }
  const dataProviderId = current.dataProvider?.id?.trim();
  if (!dataProviderId)
    return errorJson(
      409,
      'content_transfer_source_changed',
      'Der aktuelle Inhaber ist nicht eindeutig.'
    );
  const sourceEnrichment = await resolveOwnershipSourceEnrichment({
    actor,
    contentType: route.contentType,
    contentId: route.contentId,
    dataProviderId,
    operation: route.operation,
  });
  const access = await resolveMainserverResourceAccess({
    actor,
    actions: ['content.transferOwnership'],
    contentType: route.contentType,
    contentId: route.contentId,
    item: current,
    forceExactScopeActions: ['content.transferOwnership'],
    ...(sourceEnrichment.status === 'resolved'
      ? {}
      : { requireAllScopeActions: ['content.transferOwnership'] }),
  });
  const resolvedSource =
    sourceEnrichment.status === 'resolved' ? sourceEnrichment.source : undefined;
  const source = {
    dataProviderId,
    displayName:
      current.dataProvider?.name?.trim() || resolvedSource?.dataProviderName || dataProviderId,
    ...(resolvedSource ? { principal: resolvedSource.principal } : {}),
    principalResolution: sourceEnrichment.status,
  };
  if (route.operation === 'authorization') {
    return json({
      data: { canTransfer: access['content.transferOwnership'] === true },
      currentOwner: {
        ...(source.principal ? { principal: source.principal } : {}),
        principalResolution: source.principalResolution,
        displayName: source.displayName,
      },
    });
  }
  if (access['content.transferOwnership'] !== true) {
    return errorJson(403, 'content_transfer_permission_missing', 'Die Transferberechtigung fehlt.');
  }
  return handleTargets(request, route, actor, source);
};

const handleSurveyAuthorization = async (
  route: ContentOwnershipRouteMatch,
  actor: MainserverMutationActor
): Promise<Response> => {
  const current = await getSvaMainserverSurvey({ ...actor, surveyId: route.contentId });
  if (!current) return errorJson(404, 'not_found', 'Inhalt wurde nicht gefunden.');
  const dataProviderId = current.dataProvider?.id?.trim();
  if (!dataProviderId) {
    return errorJson(
      409,
      'content_transfer_source_changed',
      'Der aktuelle Inhaber ist nicht eindeutig.'
    );
  }
  const sourceEnrichment = await resolveOwnershipSourceEnrichment({
    actor,
    contentType: route.contentType,
    contentId: route.contentId,
    dataProviderId,
    operation: route.operation,
  });
  const resolvedSource =
    sourceEnrichment.status === 'resolved' ? sourceEnrichment.source : undefined;
  return json({
    data: { canTransfer: false },
    currentOwner: {
      ...(resolvedSource ? { principal: resolvedSource.principal } : {}),
      principalResolution: sourceEnrichment.status,
      displayName:
        current.dataProvider?.name?.trim() || resolvedSource?.dataProviderName || dataProviderId,
    },
  });
};

const dispatchAuthenticated = async (
  request: Request,
  route: ContentOwnershipRouteMatch,
  ctx: AuthenticatedRequestContext,
  reconcilePreviousTransfer?: MainserverOwnershipTransferReconciler
): Promise<Response> => {
  if (route.contentType === 'surveys.survey' && route.operation !== 'authorization') {
    return errorJson(
      409,
      'content_transfer_type_unsupported',
      'Dieser Inhaltstyp unterstützt noch keinen Transfer.'
    );
  }
  const actor = await resolveOwnershipRouteActor(request, ctx);
  if (isResponse(actor)) {
    return route.operation === 'transfer' ? withMutationNotApplied(actor) : actor;
  }
  if (route.contentType === 'surveys.survey') {
    try {
      return await handleSurveyAuthorization(route, actor);
    } catch (error) {
      return ownershipRouteFailureResponse(
        error,
        actor,
        route,
        'Die Inhaberanzeige ist fehlgeschlagen.'
      );
    }
  }
  const supportedRoute: SupportedContentOwnershipRouteMatch = {
    ...route,
    contentType: route.contentType,
  };
  const providerContentId =
    supportedRoute.contentType === 'projects.project'
      ? ((
          await loadExternalContentReferenceByContentId({
            ...projectSourceReferenceInput(actor.instanceId),
            contentId: route.contentId,
          }).catch(() => undefined)
        )?.sourceEntityId ?? route.contentId)
      : supportedRoute.contentId;
  const content = toOwnershipTransferContent(supportedRoute.contentType, providerContentId);
  try {
    return await (supportedRoute.operation === 'transfer'
      ? handleContentOwnershipTransfer(
          request,
          supportedRoute,
          actor,
          content,
          reconcilePreviousTransfer
        )
      : handleAuthorizedTargets(request, supportedRoute, actor, content));
  } catch (error) {
    if (error instanceof ContentOwnershipAccountSearchError) {
      return ownershipRouteFailureResponse(
        new SvaMainserverError({
          code: 'identity_provider_unavailable',
          message: 'Die Account-Suche ist derzeit nicht verfügbar.',
          statusCode: 503,
        }),
        actor,
        route,
        'Die Inhaberübertragung ist fehlgeschlagen.'
      );
    }
    return ownershipRouteFailureResponse(
      error,
      actor,
      route,
      'Die Inhaberübertragung ist fehlgeschlagen.'
    );
  }
};

export const dispatchSvaMainserverContentOwnershipRequest = async (
  request: Request,
  options: Readonly<{
    reconcilePreviousTransfer?: MainserverOwnershipTransferReconciler;
  }> = {}
): Promise<Response | null> => {
  const operationId = readTransferOperationId(request);
  if (operationId) {
    return withAuthenticatedUser(request, (ctx) =>
      readTransferOperation(request, ctx, operationId)
    );
  }
  const route = matchContentOwnershipRoute(request);
  if (!route) return null;
  const methodAllowed =
    ((route.operation === 'authorization' || route.operation === 'targets') &&
      request.method === 'GET') ||
    (route.operation === 'transfer' && request.method === 'POST');
  if (!methodAllowed)
    return errorJson(405, 'method_not_allowed', 'HTTP-Methode wird nicht unterstützt.');
  return withAuthenticatedUser(request, async (ctx) => {
    const response = await dispatchAuthenticated(
      request,
      route,
      ctx,
      options.reconcilePreviousTransfer
    );
    return route.operation === 'targets' && response.ok
      ? withMainserverContextBinding(response, ctx)
      : response;
  });
};
