import {
  authorizeContentPrimitiveForUser,
  readConfiguredPluginTenantAccess,
  validateCsrf,
  withAuthenticatedUser,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import { errorJson, json, matchRequestRoute } from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { parseMainserverListQuery } from './list-pagination.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';
import { resolveMainserverMutationActor } from './mutation-principal.js';
import { handleTourCreate } from './tour-create.js';
import { createServiceContext } from './service-internals/service-context.js';
import { createTourReads } from './tour-reads.js';

const logger = createSdkLogger({ component: 'sva-mainserver-tours-route', level: 'info' });
let context: ReturnType<typeof createServiceContext> | undefined;
let tourReads: ReturnType<typeof createTourReads> | undefined;
const getContext = () => (context ??= createServiceContext());
const getReads = () => (tourReads ??= createTourReads(getContext()));

export const listSvaMainserverTours: ReturnType<typeof createTourReads>['list'] = (...input) =>
  getReads().list(...input);
export const getSvaMainserverTour: ReturnType<typeof createTourReads>['detail'] = (...input) =>
  getReads().detail(...input);

export const dispatchSvaMainserverToursRequest = async (
  request: Request
): Promise<Response | null> => {
  const route = matchRequestRoute(request, '/api/v1/mainserver/tours', 'tours');
  if (!route) return null;
  const create = route.kind === 'collection' && request.method === 'POST';
  if (request.method !== 'GET' && !create)
    return errorJson(405, 'method_not_allowed', 'Diese Methode wird für Touren nicht unterstützt.');

  return withAuthenticatedUser(request, async (ctx) => {
    try {
      const authorization = await authorizeContentPrimitiveForUser({
        ctx,
        action: create ? 'tours.create' : 'tours.read',
        resource: { contentType: 'tours.tour' },
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

      if (create) {
        if (validateCsrf(request))
          return errorJson(403, 'csrf_validation_failed', 'Sicherheitsprüfung fehlgeschlagen.');
        const actor = await resolveMainserverMutationActor({
          request,
          ctx,
          authorizedActor: {
            instanceId,
            keycloakSubject,
            activeOrganizationId: organizationId,
          },
        });
        if (actor instanceof Response) return actor;
        return await handleTourCreate(request, actor, getContext(), getReads());
      }

      const actor = {
        instanceId,
        keycloakSubject,
        activeOrganizationId: organizationId,
        actingPrincipalType: organizationId ? 'organization' : 'user',
      } as const;
      if (route.kind === 'collection')
        return json(await listSvaMainserverTours(actor, parseMainserverListQuery(request)));

      const tour = await getSvaMainserverTour(actor, route.itemId);
      return tour
        ? json({ data: tour })
        : errorJson(404, 'not_found', 'Tour wurde nicht gefunden.');
    } catch (error) {
      logger.warn('Mainserver tour request failed', {
        operation: create ? 'mainserver_tours_create' : 'mainserver_tours_read',
        error_code: error instanceof SvaMainserverError ? error.code : 'internal_error',
      });
      return toMainserverErrorResponse(
        error,
        create
          ? 'Der Tourenentwurf konnte nicht angelegt werden.'
          : 'Touren konnten nicht geladen werden.'
      );
    }
  });
};
