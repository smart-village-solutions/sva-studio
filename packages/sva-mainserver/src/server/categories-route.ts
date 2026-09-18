import {
  authorizeContentPrimitiveForUser,
  completeIdempotency,
  reserveIdempotency,
  resolveActorInfo,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createHash } from 'node:crypto';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import type { SvaMainserverSaveCategoryInput } from '../types.js';
import { errorJson, json, parseJsonObjectBody } from './content-route-core.js';
import { isUnexpectedMainserverError, SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import {
  deleteSvaMainserverCategory,
  listSvaMainserverCategories,
  listSvaMainserverCategoryManagement,
  saveSvaMainserverCategory,
} from './service.js';

const CATEGORY_COLLECTION_PATH = '/api/v1/mainserver/categories';
const logger = createSdkLogger({ component: 'sva-mainserver-categories-route', level: 'info' });
type CategoryAction =
  'categories.read' | 'categories.create' | 'categories.update' | 'categories.delete';
type CategoriesActor = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};

const route = (request: Request) => {
  const pathname = new URL(request.url).pathname;
  if (pathname === CATEGORY_COLLECTION_PATH) return { kind: 'collection' as const };
  const prefix = `${CATEGORY_COLLECTION_PATH}/`;
  if (!pathname.startsWith(prefix)) return null;
  const id = decodeURIComponent(pathname.slice(prefix.length)).trim();
  return id && !id.includes('/') ? { kind: 'item' as const, id } : null;
};

const authorize = async (
  ctx: AuthenticatedRequestContext,
  action: CategoryAction
): Promise<CategoriesActor | Response> => {
  const result = await authorizeContentPrimitiveForUser({ ctx, action });
  if (!result.ok)
    return errorJson(result.status, result.error, result.message, result.permissionDenial);
  return {
    instanceId: result.actor.instanceId,
    keycloakSubject: result.actor.keycloakSubject,
    activeOrganizationId: result.actor.organizationId ?? ctx.activeOrganizationId,
  };
};

const stringOrNull = (value: unknown, field: string): string | null | Response => {
  if (value === null) return null;
  if (typeof value !== 'string')
    return errorJson(400, 'category_management_invalid_request', `${field} ist ungültig.`);
  return value.trim() || null;
};

const parseSaveInput = async (
  request: Request,
  id?: string
): Promise<SvaMainserverSaveCategoryInput | Response> => {
  const body = await parseJsonObjectBody(request, 'Kategorienanfrage muss ein Objekt enthalten.');
  if (body instanceof Response) return body;
  if ((id && body.id !== undefined && body.id !== id) || (!id && body.id !== undefined))
    return errorJson(
      400,
      'category_management_invalid_request',
      'Die Kategorien-ID darf nicht manipuliert werden.'
    );
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const active = body.active === undefined ? !id : body.active;
  const parentId = stringOrNull(body.parentId ?? null, 'parentId');
  const iconName = stringOrNull(body.iconName ?? null, 'iconName');
  const email = stringOrNull(body.email ?? null, 'email');
  const position = body.position === undefined || body.position === null ? null : body.position;
  const dataTypes = body.dataTypes;
  if (
    !name ||
    typeof active !== 'boolean' ||
    parentId instanceof Response ||
    iconName instanceof Response ||
    email instanceof Response ||
    (position !== null &&
      (typeof position !== 'number' || !Number.isInteger(position) || position < 0)) ||
    !Array.isArray(dataTypes) ||
    dataTypes.some((entry) => typeof entry !== 'string' || !entry.trim())
  )
    return errorJson(
      400,
      'category_management_invalid_request',
      'Die Kategorienfelder sind ungültig.'
    );
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))
    return errorJson(
      400,
      'category_management_invalid_request',
      'Die E-Mail-Adresse ist ungültig.'
    );
  const normalizedTypes = [...new Set(dataTypes.map((entry) => entry.trim()))];
  return {
    ...(id ? { id } : {}),
    name,
    active,
    parentId,
    position: position as number | null,
    iconName,
    email,
    dataTypes: normalizedTypes,
  };
};

const dispatchAuthenticated = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const matched = route(request);
  if (!matched) return errorJson(404, 'not_found', 'Kategorienroute wurde nicht gefunden.');
  const url = new URL(request.url);
  const action: CategoryAction | null =
    request.method === 'GET'
      ? 'categories.read'
      : request.method === 'POST' && matched.kind === 'collection'
        ? 'categories.create'
        : request.method === 'PUT' && matched.kind === 'item'
          ? 'categories.update'
          : request.method === 'DELETE' && matched.kind === 'item'
            ? 'categories.delete'
            : null;
  if (!action)
    return errorJson(
      405,
      'method_not_allowed',
      'Methode wird für Mainserver-Kategorien nicht unterstützt.'
    );
  try {
    const actor = await authorize(ctx, action);
    if (actor instanceof Response) return actor;
    if (request.method === 'GET') {
      if (matched.kind !== 'collection')
        return errorJson(
          405,
          'method_not_allowed',
          'Methode wird für Mainserver-Kategorien nicht unterstützt.'
        );
      if (url.searchParams.get('view') === null)
        return json({ data: await listSvaMainserverCategories(actor) });
      if (url.searchParams.get('view') !== 'management')
        return errorJson(
          400,
          'category_management_invalid_request',
          'Die Kategorienansicht ist ungültig.'
        );
      return json({ data: await listSvaMainserverCategoryManagement(actor) });
    }
    if (request.method === 'DELETE' && matched.kind === 'item')
      return json(await deleteSvaMainserverCategory({ ...actor, categoryId: matched.id }));
    let idempotency: { readonly actorAccountId: string; readonly key: string } | undefined;
    if (request.method === 'POST') {
      const key = request.headers.get('idempotency-key')?.trim();
      if (!key)
        return errorJson(
          400,
          'idempotency_key_required',
          'Header Idempotency-Key ist erforderlich.'
        );
      const actorInfo = await resolveActorInfo(request, ctx, { requireActorMembership: true });
      if ('error' in actorInfo || !actorInfo.actor.actorAccountId)
        return 'error' in actorInfo
          ? actorInfo.error
          : errorJson(403, 'forbidden', 'Keine Berechtigung für diese Kategorienoperation.');
      const reservation = await reserveIdempotency({
        instanceId: actor.instanceId,
        actorAccountId: actorInfo.actor.actorAccountId,
        endpoint: 'POST:/api/v1/mainserver/categories',
        idempotencyKey: key,
        payloadHash: createHash('sha256')
          .update(await request.clone().text())
          .digest('hex'),
      });
      if (reservation.status === 'replay')
        return json(reservation.responseBody, reservation.responseStatus);
      if (reservation.status === 'conflict')
        return errorJson(409, 'idempotency_key_reuse', reservation.message);
      idempotency = { actorAccountId: actorInfo.actor.actorAccountId, key };
    }
    const category = await parseSaveInput(
      request,
      matched.kind === 'item' ? matched.id : undefined
    );
    if (category instanceof Response) return category;
    const result = await saveSvaMainserverCategory({ ...actor, category });
    const status =
      result.category && result.errors.length === 0 ? (request.method === 'POST' ? 201 : 200) : 422;
    const body = result;
    if (idempotency)
      await completeIdempotency({
        instanceId: actor.instanceId,
        actorAccountId: idempotency.actorAccountId,
        endpoint: 'POST:/api/v1/mainserver/categories',
        idempotencyKey: idempotency.key,
        responseBody: body,
        responseStatus: status,
        status: status < 400 ? 'COMPLETED' : 'FAILED',
      });
    return json(body, status);
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
  if (!route(request)) return null;
  return withAuthenticatedUser(request, (ctx) => dispatchAuthenticated(request, ctx));
};
