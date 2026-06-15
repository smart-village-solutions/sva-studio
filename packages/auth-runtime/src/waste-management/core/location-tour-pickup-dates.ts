import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction } from './auth.js';
import { runWasteCreateMutation, runWasteDeleteMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementTourSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, normalizeOptionalString, requireActorInstanceId, requireDeps } from './utils.js';

const {
  createWasteLocationTourPickupDateSchema,
  updateWasteLocationTourPickupDateSchema,
} = wasteManagementTourSchemas;

const toLocationTourPickupDateInput = (
  id: string,
  data: {
    locationId: string;
    tourId: string;
    pickupDate: string;
    note?: string;
  }
) => ({
  id,
  locationId: data.locationId,
  tourId: data.tourId,
  pickupDate: data.pickupDate,
  note: normalizeOptionalString(data.note) ?? null,
});

export const wasteManagementLocationTourPickupDateHandlers = {
  createWasteManagementLocationTourPickupDateInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, createWasteLocationTourPickupDateSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const duplicatePickupDates = await requireDeps(
      deps.listWasteLocationTourPickupDates,
      'listWasteLocationTourPickupDates'
    )(instanceId, {
      locationId: parsed.data.locationId,
      tourId: parsed.data.tourId,
      pickupDate: parsed.data.pickupDate,
    });
    const conflictingPickupDate = duplicatePickupDates.find((entry) => entry.id !== parsed.data.id);
    if (conflictingPickupDate) {
      return createApiError(
        409,
        'conflict',
        'Für diesen Standort, diese Tour und dieses Datum existiert bereits ein ortsbezogener Waste-Termin.',
        requestId
      );
    }

    return runWasteCreateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: parsed.data.id,
      audit: {
        actionId: 'waste-management.location-tour-pickup-date.created',
        resourceType: 'waste_location_tour_pickup_date',
      },
      messages: {
        verificationFailed: 'Der ortsbezogene Waste-Termin konnte nicht verifiziert werden.',
        persistenceFailed: 'Der ortsbezogene Waste-Termin konnte nicht gespeichert werden.',
      },
      save: () =>
        requireDeps(deps.saveWasteLocationTourPickupDate, 'saveWasteLocationTourPickupDate')(
          instanceId,
          toLocationTourPickupDateInput(parsed.data.id, parsed.data)
        ),
      loadSaved: () =>
        requireDeps(deps.loadWasteLocationTourPickupDateById, 'loadWasteLocationTourPickupDateById')(
          instanceId,
          parsed.data.id
        ),
    });
  },
  updateWasteManagementLocationTourPickupDateInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const pickupDateId = readPathSegment(request, 4)?.trim();
    if (!pickupDateId) {
      return createApiError(400, 'invalid_request', 'pickupDateId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteLocationTourPickupDateSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const loadPickupDate = requireDeps(deps.loadWasteLocationTourPickupDateById, 'loadWasteLocationTourPickupDateById');
    const savePickupDate = requireDeps(deps.saveWasteLocationTourPickupDate, 'saveWasteLocationTourPickupDate');

    return runWasteUpdateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: pickupDateId,
      audit: {
        actionId: 'waste-management.location-tour-pickup-date.updated',
        resourceType: 'waste_location_tour_pickup_date',
      },
      messages: {
        notFound: 'Der ortsbezogene Waste-Termin wurde nicht gefunden.',
        verificationFailed: 'Der ortsbezogene Waste-Termin konnte nicht verifiziert werden.',
        persistenceFailed: 'Der ortsbezogene Waste-Termin konnte nicht gespeichert werden.',
      },
      loadExisting: () => loadPickupDate(instanceId, pickupDateId),
      save: () => savePickupDate(instanceId, toLocationTourPickupDateInput(pickupDateId, parsed.data)),
      loadSaved: () => loadPickupDate(instanceId, pickupDateId),
    });
  },
  deleteWasteManagementLocationTourPickupDateInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const pickupDateId = readPathSegment(request, 4)?.trim();
    if (!pickupDateId) {
      return createApiError(400, 'invalid_request', 'pickupDateId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const loadPickupDate = requireDeps(deps.loadWasteLocationTourPickupDateById, 'loadWasteLocationTourPickupDateById');
    const deletePickupDate = requireDeps(deps.deleteWasteLocationTourPickupDate, 'deleteWasteLocationTourPickupDate');

    return runWasteDeleteMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: pickupDateId,
      audit: {
        actionId: 'waste-management.location-tour-pickup-date.deleted',
        resourceType: 'waste_location_tour_pickup_date',
      },
      messages: {
        notFound: 'Der ortsbezogene Waste-Termin wurde nicht gefunden.',
        deleteFailed: 'Der ortsbezogene Waste-Termin konnte nicht gelöscht werden.',
      },
      loadExisting: () => loadPickupDate(instanceId, pickupDateId),
      remove: () => deletePickupDate(instanceId, pickupDateId),
    });
  },
};
