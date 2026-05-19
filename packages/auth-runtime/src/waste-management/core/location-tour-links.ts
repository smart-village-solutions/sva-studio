import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, getAuthorizedWasteManagementInstanceId } from './auth.js';
import { runWasteCreateMutation, runWasteDeleteMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementTourSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, normalizeOptionalString, requireDeps } from './utils.js';

const { createWasteLocationTourLinkSchema, updateWasteLocationTourLinkSchema } = wasteManagementTourSchemas;

const toLocationTourLinkInput = (
  id: string,
  data: {
    locationId: string;
    tourId: string;
    startDate?: string;
    endDate?: string;
  }
) => ({
  id,
  locationId: data.locationId,
  tourId: data.tourId,
  startDate: normalizeOptionalString(data.startDate),
  endDate: normalizeOptionalString(data.endDate),
});

export const wasteManagementLocationTourLinkHandlers = {
  createWasteManagementLocationTourLinkInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = getAuthorizedWasteManagementInstanceId(ctx);

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, createWasteLocationTourLinkSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    return runWasteCreateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: parsed.data.id,
      audit: {
        actionId: 'waste-management.location-tour-link.created',
        resourceType: 'waste_location_tour_link',
      },
      messages: {
        verificationFailed: 'Die Waste-Tour-Zuordnung konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Tour-Zuordnung konnte nicht gespeichert werden.',
      },
      save: () =>
        requireDeps(deps.saveWasteLocationTourLink, 'saveWasteLocationTourLink')(
          instanceId,
          toLocationTourLinkInput(parsed.data.id, parsed.data)
        ),
      loadSaved: () =>
        requireDeps(deps.loadWasteLocationTourLinkById, 'loadWasteLocationTourLinkById')(instanceId, parsed.data.id),
    });
  },
  updateWasteManagementLocationTourLinkInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = getAuthorizedWasteManagementInstanceId(ctx);

    const linkId = readPathSegment(request, 4)?.trim();
    if (!linkId) {
      return createApiError(400, 'invalid_request', 'linkId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteLocationTourLinkSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const loadLocationTourLink = requireDeps(deps.loadWasteLocationTourLinkById, 'loadWasteLocationTourLinkById');
    const saveLocationTourLink = requireDeps(deps.saveWasteLocationTourLink, 'saveWasteLocationTourLink');

    return runWasteUpdateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: linkId,
      audit: {
        actionId: 'waste-management.location-tour-link.deleted',
        resourceType: 'waste_location_tour_link',
      },
      messages: {
        notFound: 'Die Waste-Tour-Zuordnung wurde nicht gefunden.',
        verificationFailed: 'Die Waste-Tour-Zuordnung konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Tour-Zuordnung konnte nicht gespeichert werden.',
      },
      loadExisting: () => loadLocationTourLink(instanceId, linkId),
      save: () => saveLocationTourLink(instanceId, toLocationTourLinkInput(linkId, parsed.data)),
      loadSaved: () => loadLocationTourLink(instanceId, linkId),
    });
  },
  deleteWasteManagementLocationTourLinkInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = getAuthorizedWasteManagementInstanceId(ctx);
    const linkId = readPathSegment(request, 4)?.trim();
    if (!linkId) {
      return createApiError(400, 'invalid_request', 'linkId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const loadLocationTourLink = requireDeps(deps.loadWasteLocationTourLinkById, 'loadWasteLocationTourLinkById');
    const deleteLocationTourLink = requireDeps(deps.deleteWasteLocationTourLink, 'deleteWasteLocationTourLink');

    return runWasteDeleteMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: linkId,
      audit: {
        actionId: 'waste-management.location-tour-link.updated',
        resourceType: 'waste_location_tour_link',
      },
      messages: {
        notFound: 'Die Waste-Tour-Zuordnung wurde nicht gefunden.',
        deleteFailed: 'Die Waste-Tour-Zuordnung konnte nicht gelöscht werden.',
      },
      loadExisting: () => loadLocationTourLink(instanceId, linkId),
      remove: () => deleteLocationTourLink(instanceId, linkId),
    });
  },
};
