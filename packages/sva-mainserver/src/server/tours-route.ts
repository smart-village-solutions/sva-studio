import {
  authorizeContentPrimitiveForUser,
  readConfiguredPluginTenantAccess,
  validateCsrf,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import type { SvaMainserverConnectionInput } from '../types.js';
import {
  errorJson,
  json,
  matchRequestRoute,
  withMutationNotApplied,
} from './content-route-core.js';
import {
  MAINSERVER_ACTING_PRINCIPAL_HEADER,
  withMainserverContextBinding,
} from './content-route-context.js';
import { SvaMainserverError } from './errors.js';
import { parseMainserverListQuery } from './list-pagination.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import { isMainserverMutationCapabilityEnabled } from './mainserver-mutation-capabilities.js';
import {
  resolveMainserverMutationActor,
  resolveMainserverResourceActor,
} from './mutation-principal.js';
import { handleTourCreate } from './tour-create.js';
import { createTourEditor, handleTourUpdate, hasExactTourEditorAccess } from './tour-editor.js';
import { createServiceContext } from './service-internals/service-context.js';
import { createTourReads } from './tour-reads.js';

const logger = createSdkLogger({ component: 'sva-mainserver-tours-route', level: 'info' });
let context: ReturnType<typeof createServiceContext> | undefined;
let tourReads: ReturnType<typeof createTourReads> | undefined;
let tourEditor: ReturnType<typeof createTourEditor> | undefined;
const collectionPath = '/api/v1/mainserver/tours';
const contentType = 'tours.tour';
const updateAction = 'tours.update';
const getContext = () => (context ??= createServiceContext());
const getReads = () => (tourReads ??= createTourReads(getContext()));
const getEditor = () => (tourEditor ??= createTourEditor(getContext()));

const matchEditor = (request: Request) => {
  const pathname = new URL(request.url).pathname;
  if (!pathname.endsWith('/editor')) return null;
  const url = new URL(request.url);
  url.pathname = pathname.slice(0, -'/editor'.length);
  const route = matchRequestRoute(new Request(url), collectionPath, 'tours');
  return route?.kind === 'item' ? route : null;
};

const hasActivePrincipal = (actor: SvaMainserverConnectionInput) =>
  actor.actingPrincipalType === (actor.activeOrganizationId ? 'organization' : 'user');

const readEditor = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  authorizedActor: SvaMainserverConnectionInput,
  id: string
) => {
  // The read uses the same principal as the existing list and detail routes.
  const headers = new Headers(request.headers);
  headers.set(
    MAINSERVER_ACTING_PRINCIPAL_HEADER,
    authorizedActor.activeOrganizationId ? 'organization' : 'user'
  );
  const actor = await resolveMainserverResourceActor({
    request: new Request(request.url, { method: request.method, headers }),
    ctx,
    authorizedActor,
  });
  if (!actor || !hasActivePrincipal(actor))
    return errorJson(403, 'forbidden', 'Die Tour kann im aktiven Kontext nicht bearbeitet werden.');
  const tour = await getEditor().read(actor, id);
  if (!tour) return errorJson(404, 'not_found', 'Tour wurde nicht gefunden.');
  if (!(await hasExactTourEditorAccess(actor, tour)))
    return errorJson(403, 'forbidden', 'Die Tour kann im aktiven Kontext nicht bearbeitet werden.');
  return withMainserverContextBinding(json({ data: tour }), ctx);
};

const writeTour = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  authorizedActor: SvaMainserverConnectionInput,
  updateId?: string
) => {
  if (validateCsrf(request))
    return errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.');
  const actor = await resolveMainserverMutationActor({ request, ctx, authorizedActor });
  if (actor instanceof Response) return actor;
  if (!updateId) return handleTourCreate(request, actor, getContext(), getReads(), ctx);
  if (!hasActivePrincipal(actor))
    return withMutationNotApplied(
      errorJson(403, 'forbidden', 'Die Tour kann im aktiven Kontext nicht bearbeitet werden.')
    );
  return handleTourUpdate(request, actor, updateId, getEditor(), ctx);
};

export const listSvaMainserverTours: ReturnType<typeof createTourReads>['list'] = (...input) =>
  getReads().list(...input);
export const getSvaMainserverTour: ReturnType<typeof createTourReads>['detail'] = (...input) =>
  getReads().detail(...input);

type TourOperation =
  { kind: 'editor' | 'detail' | 'update'; id: string } | { kind: 'list' } | { kind: 'create' };

const unsupportedMethod = () =>
  errorJson(405, 'method_not_allowed', 'Diese Methode wird für Touren nicht unterstützt.');

const matchTourOperation = (request: Request): TourOperation | Response | null => {
  const editor = matchEditor(request);
  if (editor)
    return request.method === 'GET' ? { kind: 'editor', id: editor.itemId } : unsupportedMethod();

  const route = matchRequestRoute(request, collectionPath, 'tours');
  if (!route) return null;
  if (route.kind === 'collection') {
    if (request.method === 'GET') return { kind: 'list' };
    if (request.method === 'POST') return { kind: 'create' };
  } else {
    if (request.method === 'GET') return { kind: 'detail', id: route.itemId };
    if (request.method === 'PATCH') return { kind: 'update', id: route.itemId };
  }
  return unsupportedMethod();
};

const routeActions = {
  create: 'tours.create',
  detail: 'tours.read',
  editor: updateAction,
  list: 'tours.read',
  update: updateAction,
} as const;

const dispatchTourOperation = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  route: TourOperation,
  authorizedActor: SvaMainserverConnectionInput
): Promise<Response> => {
  switch (route.kind) {
    case 'editor':
      return readEditor(request, ctx, authorizedActor, route.id);
    case 'update':
      return writeTour(request, ctx, authorizedActor, route.id);
    case 'create':
      return writeTour(request, ctx, authorizedActor);
    default: {
      const actor = {
        ...authorizedActor,
        actingPrincipalType: authorizedActor.activeOrganizationId ? 'organization' : 'user',
      } as const;
      if (route.kind === 'list')
        return json(await listSvaMainserverTours(actor, parseMainserverListQuery(request)));
      const tour = await getSvaMainserverTour(actor, route.id);
      return tour
        ? json({ data: tour })
        : errorJson(404, 'not_found', 'Tour wurde nicht gefunden.');
    }
  }
};

export const dispatchSvaMainserverToursRequest = async (
  request: Request
): Promise<Response | null> => {
  const route = matchTourOperation(request);
  if (!route || route instanceof Response) return route;
  const action = routeActions[route.kind];
  const editing = action === updateAction;

  return withAuthenticatedUser(request, async (ctx) => {
    try {
      if (editing && !isMainserverMutationCapabilityEnabled(updateAction))
        return withMutationNotApplied(
          errorJson(
            503,
            'mainserver_capability_unconfirmed',
            'Tourenbearbeitung ist noch nicht freigegeben.'
          )
        );
      const authorization = await authorizeContentPrimitiveForUser({
        ctx,
        action,
        resource: { contentType, ...(editing && 'id' in route ? { contentId: route.id } : {}) },
        ...(editing ? { credentialVisibleCompatibility: true } : {}),
      });
      if (!authorization.ok) {
        return errorJson(
          authorization.status,
          authorization.error,
          authorization.message,
          authorization.permissionDenial
        );
      }
      const { instanceId, keycloakSubject, organizationId } = authorization.actor;
      const access = await readConfiguredPluginTenantAccess(instanceId, 'tours');
      if (!access.allowed)
        return errorJson(403, 'forbidden', 'Das Tourenmodul ist nicht verfügbar.');

      return await dispatchTourOperation(request, ctx, route, {
        instanceId,
        keycloakSubject,
        activeOrganizationId: organizationId,
      });
    } catch (error) {
      logger.warn('Mainserver tour request failed', {
        operation: `mainserver_tours_${route.kind}`,
        error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
      });
      return toMainserverErrorResponse(error, 'Die Tourenanfrage konnte nicht verarbeitet werden.');
    }
  });
};
