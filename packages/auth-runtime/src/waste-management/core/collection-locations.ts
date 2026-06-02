import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, getAuthorizedWasteManagementInstanceId } from './auth.js';
import { runWasteCreateMutation, runWasteDeleteMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, normalizeOptionalString, requireDeps } from './utils.js';

const { createWasteCollectionLocationSchema, updateWasteCollectionLocationSchema } = wasteManagementMasterDataSchemas;

type PgLikeError = Error & {
  code?: string;
  column?: string;
  table?: string;
};

const mapCollectionLocationPersistenceErrorMessage = (error: unknown): string | undefined => {
  const pgError = error as PgLikeError;
  if (pgError?.code !== '23502' || pgError.table !== 'waste_collection_locations') {
    return undefined;
  }

  if (pgError.column === 'street_id') {
    return 'Der Waste-Abholort konnte nicht gespeichert werden, weil die angebundene Waste-Datenquelle derzeit eine Straße verlangt. "Alle Straßen" ist dort aktuell nicht zulässig.';
  }

  if (pgError.column === 'house_number_id') {
    return 'Der Waste-Abholort konnte nicht gespeichert werden, weil die angebundene Waste-Datenquelle derzeit eine Hausnummer verlangt. "Alle Hausnummern" ist dort aktuell nicht zulässig.';
  }

  return undefined;
};

const toCollectionLocationInput = (
  id: string,
  data: {
    cityId: string;
    regionId?: string;
    streetId?: string;
    houseNumberId?: string;
    active: boolean;
  }
) => ({
  id,
  cityId: data.cityId,
  regionId: normalizeOptionalString(data.regionId),
  streetId: normalizeOptionalString(data.streetId),
  houseNumberId: normalizeOptionalString(data.houseNumberId),
  active: data.active,
});

export const wasteManagementCollectionLocationHandlers = {
  createWasteManagementCollectionLocationInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = getAuthorizedWasteManagementInstanceId(ctx);

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, createWasteCollectionLocationSchema);
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
        actionId: 'waste-management.collection-location.created',
        resourceType: 'waste_collection_location',
      },
      messages: {
        verificationFailed: 'Der Waste-Abholort konnte nicht verifiziert werden.',
        persistenceFailed: 'Der Waste-Abholort konnte nicht gespeichert werden.',
        mapPersistenceErrorMessage: mapCollectionLocationPersistenceErrorMessage,
      },
      save: () =>
        requireDeps(deps.saveWasteCollectionLocation, 'saveWasteCollectionLocation')(
          instanceId,
          toCollectionLocationInput(parsed.data.id, parsed.data)
        ),
      loadSaved: () =>
        requireDeps(deps.loadWasteCollectionLocationById, 'loadWasteCollectionLocationById')(instanceId, parsed.data.id),
    });
  },
  updateWasteManagementCollectionLocationInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = getAuthorizedWasteManagementInstanceId(ctx);

    const locationId = readPathSegment(request, 4)?.trim();
    if (!locationId) {
      return createApiError(400, 'invalid_request', 'locationId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteCollectionLocationSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const loadCollectionLocation = requireDeps(
      deps.loadWasteCollectionLocationById,
      'loadWasteCollectionLocationById'
    );
    const saveCollectionLocation = requireDeps(deps.saveWasteCollectionLocation, 'saveWasteCollectionLocation');

    return runWasteUpdateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: locationId,
      audit: {
        actionId: 'waste-management.collection-location.updated',
        resourceType: 'waste_collection_location',
      },
      messages: {
        notFound: 'Der Waste-Abholort wurde nicht gefunden.',
        verificationFailed: 'Der Waste-Abholort konnte nicht verifiziert werden.',
        persistenceFailed: 'Der Waste-Abholort konnte nicht gespeichert werden.',
        mapPersistenceErrorMessage: mapCollectionLocationPersistenceErrorMessage,
      },
      loadExisting: () => loadCollectionLocation(instanceId, locationId),
      save: () => saveCollectionLocation(instanceId, toCollectionLocationInput(locationId, parsed.data)),
      loadSaved: () => loadCollectionLocation(instanceId, locationId),
    });
  },
  deleteWasteManagementCollectionLocationInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = getAuthorizedWasteManagementInstanceId(ctx);
    const locationId = readPathSegment(request, 4)?.trim();
    if (!locationId) {
      return createApiError(400, 'invalid_request', 'locationId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const loadCollectionLocation = requireDeps(
      deps.loadWasteCollectionLocationById,
      'loadWasteCollectionLocationById'
    );
    const deleteCollectionLocation = requireDeps(
      deps.deleteWasteCollectionLocation,
      'deleteWasteCollectionLocation'
    );

    return runWasteDeleteMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: locationId,
      audit: {
        actionId: 'waste-management.collection-location.deleted',
        resourceType: 'waste_collection_location',
      },
      messages: {
        notFound: 'Der Waste-Abholort wurde nicht gefunden.',
        deleteFailed: 'Der Waste-Abholort konnte nicht gelöscht werden.',
      },
      loadExisting: () => loadCollectionLocation(instanceId, locationId),
      remove: () => deleteCollectionLocation(instanceId, locationId),
    });
  },
};
