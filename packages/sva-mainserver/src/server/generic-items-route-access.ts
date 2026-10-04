import {
  authorizeContentPrimitiveForUser,
  validateCsrf,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import {
  errorJson,
  isResponse,
  json,
  type RouteMatch as SharedRouteMatch,
} from './content-route-core.js';
import { MAINSERVER_ACTING_PRINCIPAL_HEADER } from './content-route-context.js';
import { listFaqItems } from './faq-listing.js';
import { listCockpitCardItems } from './cockpit-cards-listing.js';
import { parseMainserverListQuery } from './list-pagination.js';
import {
  resolveMainserverMutationActor,
  resolveMainserverResourceAccess,
  resolveMainserverResourceActor,
  type MainserverMutationActor,
} from './mutation-principal.js';
import { getSvaMainserverGenericItem, listSvaMainserverGenericItems } from './service.js';

const GENERIC_ITEMS_CONTENT_TYPE = 'generic-items.generic-item';
const FAQ_CONTENT_TYPE = 'faq.faq';
const COCKPIT_CARDS_CONTENT_TYPE = 'cockpit-cards.cockpit-card';
const logger = createSdkLogger({ component: 'sva-mainserver-generic-items-route', level: 'info' });
export type ContentKind = 'generic-items' | 'faq' | 'cockpit-cards';
type ContentActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};
export type RouteMatch = SharedRouteMatch<ContentKind>;

export const contentTypeFor = (contentKind: ContentKind) =>
  contentKind === 'faq'
    ? FAQ_CONTENT_TYPE
    : contentKind === 'cockpit-cards'
      ? COCKPIT_CARDS_CONTENT_TYPE
      : GENERIC_ITEMS_CONTENT_TYPE;

export const pluginActionFor = (
  contentKind: ContentKind,
  actionName: 'read' | 'create' | 'update' | 'delete'
) => `${contentKind}.${actionName}`;

const validateMutationRequest = (request: Request, requestId?: string): Response | null => {
  const csrfError = validateCsrf(request, requestId);
  return csrfError
    ? errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.')
    : null;
};

const authorizeOrResponse = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  contentType: string,
  contentId?: string,
  credentialVisibleRead = true
): Promise<ContentActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action,
    resource: {
      contentType,
      ...(contentId ? { contentId } : {}),
    },
    credentialVisibleCompatibility:
      !action.endsWith('.read') || (Boolean(contentId) && credentialVisibleRead),
  });

  if (!result.ok) {
    const workspaceContext = getWorkspaceContext();
    logger.warn('Mainserver generic items local authorization denied', {
      operation: 'mainserver_content_authorize',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      actor_id: ctx.user.id,
      instance_id: ctx.user.instanceId,
      content_type: contentType,
      content_id: contentId,
      action,
      error_code: result.error,
    });

    return errorJson(result.status, result.error, result.message, result.permissionDenial);
  }

  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    activeOrganizationId: result.actor.organizationId ?? ctx.activeOrganizationId,
  };
};

export const authorizeMutation = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  actionName: 'create' | 'update' | 'delete',
  requestId?: string,
  contentId?: string
): Promise<Response | MainserverMutationActor> => {
  const csrfError = validateMutationRequest(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const authorizedActor = await authorizeOrResponse(
    ctx,
    pluginActionFor(contentKind, actionName),
    contentTypeFor(contentKind),
    contentId
  );
  if (isResponse(authorizedActor)) {
    return authorizedActor;
  }
  return resolveMainserverMutationActor({ request, ctx, authorizedActor });
};

export const handleListRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(
    ctx,
    pluginActionFor(contentKind, 'read'),
    contentTypeFor(contentKind)
  );
  if (isResponse(actor)) {
    return actor;
  }

  const includeInvisible = new URL(request.url).searchParams.get('includeInvisible') === 'true';
  const languageCode = new URL(request.url).searchParams.get('languageCode') ?? undefined;
  const input = {
    ...actor,
    ...parseMainserverListQuery(request),
    includeInvisible,
  };
  const startedAt = Date.now();
  const faqResult =
    contentKind === 'faq'
      ? await listFaqItems(input, listSvaMainserverGenericItems, languageCode)
      : null;
  const cockpitCardsResult =
    contentKind === 'cockpit-cards'
      ? await listCockpitCardItems(input, listSvaMainserverGenericItems)
      : null;
  const specializedResult = faqResult ?? cockpitCardsResult;
  const data = specializedResult
    ? { data: specializedResult.data, pagination: specializedResult.pagination }
    : await listSvaMainserverGenericItems(input);
  if (faqResult) {
    logger.debug('FAQ list upstream pagination completed', {
      operation: 'mainserver_faq_list_upstream',
      upstream_page_count: faqResult.observability.upstreamPageCount,
      matching_item_count: faqResult.observability.matchingItemCount,
      duration_ms: Date.now() - startedAt,
    });
  }
  if (cockpitCardsResult)
    logger.debug('Kachel list upstream pagination completed', {
      operation: 'mainserver_cockpit_cards_list_upstream',
      upstream_page_count: cockpitCardsResult.observability.upstreamPageCount,
      matching_item_count: cockpitCardsResult.observability.matchingItemCount,
      duration_ms: Date.now() - startedAt,
    });
  logSuccess(
    contentKind === 'faq'
      ? 'mainserver_faq_list'
      : contentKind === 'cockpit-cards'
        ? 'mainserver_cockpit_cards_list'
        : 'mainserver_generic-items_list'
  );
  return json(data);
};

export const handleDetailRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  contentKind: ContentKind,
  itemId: string,
  logSuccess: (operation: string, contentId?: string) => void
) => {
  const actor = await authorizeOrResponse(
    ctx,
    pluginActionFor(contentKind, 'read'),
    contentTypeFor(contentKind),
    itemId,
    request.headers.has(MAINSERVER_ACTING_PRINCIPAL_HEADER)
  );
  if (isResponse(actor)) {
    return actor;
  }

  const resourceActor = await resolveMainserverResourceActor({
    request,
    ctx,
    authorizedActor: actor,
  });
  const data = await getSvaMainserverGenericItem({
    ...(resourceActor ?? actor),
    genericItemId: itemId,
  });
  if (contentKind === 'faq' && data.genericType !== 'FAQ') {
    return errorJson(404, 'not_found', 'FAQ wurde nicht gefunden.');
  }
  if (contentKind === 'cockpit-cards' && data.genericType !== 'COCKPIT_CARD')
    return errorJson(404, 'not_found', 'Kachel wurde nicht gefunden.');
  const access = resourceActor
    ? await resolveMainserverResourceAccess({
        actor: resourceActor,
        actions: [
          pluginActionFor(contentKind, 'read'),
          pluginActionFor(contentKind, 'update'),
          pluginActionFor(contentKind, 'delete'),
          'content.publish',
          'content.changeStatus',
        ],
        contentType: contentTypeFor(contentKind),
        item: data,
        forceExactScopeActions: [pluginActionFor(contentKind, 'read')],
      })
    : {};
  if (
    (resourceActor && !access[pluginActionFor(contentKind, 'read')]) ||
    (!resourceActor && request.headers.has(MAINSERVER_ACTING_PRINCIPAL_HEADER))
  ) {
    const exactRead = await authorizeOrResponse(
      ctx,
      pluginActionFor(contentKind, 'read'),
      contentTypeFor(contentKind),
      itemId,
      false
    );
    if (isResponse(exactRead)) return exactRead;
  }
  logSuccess('mainserver_generic-items_detail', itemId);
  return json(resourceActor ? { data, meta: { access } } : { data });
};
