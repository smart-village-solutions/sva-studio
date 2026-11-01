import {
  authorizeContentPrimitiveForUser,
  completeIdempotency,
  reserveIdempotency,
  resolveActorInfo,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createHash } from 'node:crypto';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverCategoriesListItem } from '../types.js';
import { CONSTRUCTION_SITES_TYPE } from './construction-sites-contract.js';
import { parseCategorySaveInput } from './categories-route-input.js';
import {
  matchCategoryRoute,
  resolveCategoryAction,
  type CategoryAction,
  type CategoryRoute,
} from './categories-route-match.js';
import { errorJson, json } from './content-route-core.js';
import { MAINSERVER_ACTING_PRINCIPAL_HEADER } from './content-route-context.js';
import { resolveMainserverResourceActor } from './mutation-principal.js';
import { isUnexpectedMainserverError, SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  deleteSvaMainserverCategory,
  listSvaMainserverCategories,
  listSvaMainserverCategoryManagement,
  saveSvaMainserverCategory,
} from './service.js';

const logger = createSdkLogger({ component: 'sva-mainserver-categories-route', level: 'info' });
type CategoriesActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};
type CategoryIdempotency = Readonly<{ actorAccountId: string; endpoint: string; key: string }>;
const categoryContentDataTypes = [
  'news_item',
  'event_record',
  'point_of_interest',
  'generic_item_voucher',
  'generic_item_construction_site',
] as const;
type CategoryContentDataType = (typeof categoryContentDataTypes)[number];

const categoryCreateEndpoint = (actor: CategoriesActor): string =>
  `POST:/api/v1/mainserver/categories#organization:${actor.activeOrganizationId ?? 'personal'}`;

const readCategoryContentDataType = (
  request: Request
): CategoryContentDataType | Response | undefined => {
  const dataTypes = new URL(request.url).searchParams.getAll('dataType');
  if (dataTypes.length === 0) return undefined;
  const dataType = dataTypes[0]?.trim();
  if (
    dataTypes.length !== 1 ||
    !dataType ||
    !categoryContentDataTypes.includes(dataType as CategoryContentDataType)
  )
    return errorJson(400, 'invalid_request', 'Der Kategorien-Datentypfilter ist ungültig.');
  return dataType as CategoryContentDataType;
};

const toCategoryResponseItem = ({
  dataTypes: _dataTypes,
  ...category
}: SvaMainserverCategoriesListItem): Omit<SvaMainserverCategoriesListItem, 'dataTypes'> => category;

const authorize = async (
  ctx: AuthenticatedRequestContext,
  action: CategoryAction | 'construction-sites.read' | 'construction-sites.create',
  request: Request
): Promise<CategoriesActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({
    ctx,
    action,
    ...(action.startsWith('construction-sites.')
      ? { resource: { contentType: CONSTRUCTION_SITES_TYPE } }
      : {}),
  });
  if (!result.ok) {
    if (action === 'construction-sites.read' && result.status === 403)
      return authorize(ctx, 'construction-sites.create', request);
    return errorJson(result.status, result.error, result.message, result.permissionDenial);
  }
  const actor = {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    activeOrganizationId: result.actor.organizationId ?? ctx.activeOrganizationId,
  };
  if (
    action.startsWith('construction-sites.') &&
    request.headers.has(MAINSERVER_ACTING_PRINCIPAL_HEADER)
  )
    return (
      (await resolveMainserverResourceActor({ request, ctx, authorizedActor: actor })) ??
      errorJson(403, 'forbidden', 'forbidden')
    );
  return actor;
};

const readCategories = async (
  request: Request,
  matched: CategoryRoute,
  actor: CategoriesActor
): Promise<Response> => {
  if (matched.kind !== 'collection')
    return errorJson(
      405,
      'method_not_allowed',
      'Methode wird für Mainserver-Kategorien nicht unterstützt.'
    );
  const view = new URL(request.url).searchParams.get('view');
  if (view === null) {
    const dataType = readCategoryContentDataType(request);
    if (dataType instanceof Response) return dataType;
    const categories = await listSvaMainserverCategories(actor);
    const filteredCategories = dataType
      ? categories.filter(
          (category) => category.dataTypes.length === 0 || category.dataTypes.includes(dataType)
        )
      : categories;
    return json({ data: filteredCategories.map(toCategoryResponseItem) });
  }
  if (view !== 'management')
    return errorJson(
      400,
      'category_management_invalid_request',
      'Die Kategorienansicht ist ungültig.'
    );
  return json({ data: await listSvaMainserverCategoryManagement(actor) });
};

const reserveCategoryCreate = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  actor: CategoriesActor
): Promise<CategoryIdempotency | Response | undefined> => {
  if (request.method !== 'POST') return undefined;
  const key = request.headers.get('idempotency-key')?.trim();
  if (!key)
    return errorJson(400, 'idempotency_key_required', 'Header Idempotency-Key ist erforderlich.');
  const actorInfo = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorInfo || !actorInfo.actor.actorAccountId)
    return 'error' in actorInfo
      ? actorInfo.error
      : errorJson(403, 'forbidden', 'Keine Berechtigung für diese Kategorienoperation.');
  const endpoint = categoryCreateEndpoint(actor);
  const reservation = await reserveIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actorInfo.actor.actorAccountId,
    endpoint,
    idempotencyKey: key,
    payloadHash: createHash('sha256')
      .update(await request.clone().text())
      .digest('hex'),
  });
  if (reservation.status === 'replay')
    return json(reservation.responseBody, reservation.responseStatus);
  if (reservation.status === 'conflict')
    return errorJson(409, 'idempotency_key_reuse', reservation.message);
  return { actorAccountId: actorInfo.actor.actorAccountId, endpoint, key };
};

const saveCategory = async (
  request: Request,
  matched: CategoryRoute,
  ctx: AuthenticatedRequestContext,
  actor: CategoriesActor
): Promise<Response> => {
  const category = await parseCategorySaveInput(
    request.clone(),
    matched.kind === 'item' ? matched.id : undefined
  );
  if (category instanceof Response) return category;
  const idempotency = await reserveCategoryCreate(request, ctx, actor);
  if (idempotency instanceof Response) return idempotency;
  const result = await saveSvaMainserverCategory({ ...actor, category });
  const succeeded = Boolean(result.category) && result.errors.length === 0;
  const status = succeeded && request.method === 'POST' ? 201 : 200;
  if (idempotency)
    await completeIdempotency({
      instanceId: actor.instanceId,
      actorAccountId: idempotency.actorAccountId,
      endpoint: idempotency.endpoint,
      idempotencyKey: idempotency.key,
      responseBody: result,
      responseStatus: status,
      status: succeeded ? 'COMPLETED' : 'FAILED',
    });
  return json(result, status);
};

const dispatchAuthenticated = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  matched: CategoryRoute
): Promise<Response> => {
  const requestedAction = resolveCategoryAction(request, matched);
  if (!requestedAction)
    return errorJson(
      405,
      'method_not_allowed',
      'Methode wird für Mainserver-Kategorien nicht unterstützt.'
    );
  const constructionLookup =
    requestedAction === 'categories.read' &&
    matched.kind === 'collection' &&
    !new URL(request.url).searchParams.has('view') &&
    readCategoryContentDataType(request) === 'generic_item_construction_site';
  const action = constructionLookup ? 'construction-sites.read' : requestedAction;
  try {
    if (request.method !== 'GET') {
      const csrfFailure = validateCsrf(request, getWorkspaceContext().requestId);
      if (csrfFailure) return csrfFailure;
    }
    const actor = await authorize(ctx, action, request);
    if (actor instanceof Response) return actor;
    if (request.method === 'GET') return await readCategories(request, matched, actor);
    if (request.method === 'DELETE' && matched.kind === 'item')
      return json(await deleteSvaMainserverCategory({ ...actor, categoryId: matched.id }));
    return await saveCategory(request, matched, ctx, actor);
  } catch (error) {
    const workspaceContext = getWorkspaceContext();
    const log = isUnexpectedMainserverError(error) ? logger.error : logger.warn;
    log('Mainserver category management request failed', {
      operation: 'mainserver_category_management',
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      instance_id: ctx.user.instanceId,
      action,
      error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
    });
    return toMainserverErrorResponse(error, 'Mainserver-Kategorien-Anfrage ist fehlgeschlagen.');
  }
};

export const dispatchSvaMainserverCategoriesRequest = async (
  request: Request
): Promise<Response | null> => {
  const matched = matchCategoryRoute(request);
  if (!matched) return null;
  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, ctx, matched));
};
