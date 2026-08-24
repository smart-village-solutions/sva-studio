import type {
  WasteCollectionLocationPageSize,
  WasteCollectionLocationQuery,
  WasteCollectionLocationSelectionFilter,
} from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { createApiError, parseRequestBody } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction } from './auth.js';
import {
  authorizeWasteMasterDataMutationPathRequest,
  authorizeWasteMasterDataMutationRequest,
} from './master-data-request-guards.js';
import {
  runWasteCreateMutation,
  runWasteDeleteMutation,
  runWasteUpdateMutation,
} from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import { createJsonApiItemResponse, logWasteReadFailure } from './read-support.js';
import type { WasteManagementHandlerDeps } from './types.js';
import {
  getRequestId,
  normalizeOptionalString,
  requireActorInstanceId,
  requireDeps,
} from './utils.js';

const { createWasteCollectionLocationSchema, updateWasteCollectionLocationSchema } =
  wasteManagementMasterDataSchemas;

const listPageSizes = new Set<number>([10, 25, 50, 100]);
const listStatuses = new Set(['all', 'active', 'inactive']);
const listSortModes = new Set(['address', 'addressWithRegion']);
const listSortDirections = new Set(['asc', 'desc']);
const listFilterKeys = ['q', 'status', 'regionId', 'cityId', 'tourId'] as const;
const listQueryKeys = [...listFilterKeys, 'sortMode', 'sortDirection', 'page', 'pageSize'] as const;

type ParsedLocationQuery<T> = { readonly ok: true; readonly value: T } | { readonly ok: false };

const readUniqueParam = (params: URLSearchParams, key: string): string | undefined | null => {
  const values = params.getAll(key).map((value) => value.trim());
  if (values.length > 1 && new Set(values).size > 1) return null;
  return values[0] || undefined;
};

const parsePositiveInteger = (value: string | undefined, fallback: number): number | null => {
  if (value === undefined) return fallback;
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
};

const parseCollectionLocationFilters = (
  request: Request,
  allowedKeys: readonly string[]
): ParsedLocationQuery<WasteCollectionLocationSelectionFilter> => {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => !allowedKeys.includes(key))) return { ok: false };
  const values = Object.fromEntries(
    listFilterKeys.map((key) => [key, readUniqueParam(params, key)])
  ) as Record<(typeof listFilterKeys)[number], string | undefined | null>;
  if (Object.values(values).some((value) => value === null)) return { ok: false };
  const status = values.status ?? 'all';
  if (!listStatuses.has(status)) return { ok: false };
  return {
    ok: true,
    value: {
      q: values.q ?? undefined,
      status: status as WasteCollectionLocationSelectionFilter['status'],
      regionId: values.regionId ?? undefined,
      cityId: values.cityId ?? undefined,
      tourId: values.tourId ?? undefined,
    },
  };
};

export const parseWasteCollectionLocationQuery = (
  request: Request
): ParsedLocationQuery<WasteCollectionLocationQuery> => {
  const filters = parseCollectionLocationFilters(request, listQueryKeys);
  if (!filters.ok) return filters;
  const params = new URL(request.url).searchParams;
  const rawSortMode = readUniqueParam(params, 'sortMode');
  const rawSortDirection = readUniqueParam(params, 'sortDirection');
  const rawPage = readUniqueParam(params, 'page');
  const rawPageSize = readUniqueParam(params, 'pageSize');
  if ([rawSortMode, rawSortDirection, rawPage, rawPageSize].some((value) => value === null)) {
    return { ok: false };
  }
  const sortMode = rawSortMode ?? 'address';
  const sortDirection = rawSortDirection ?? 'asc';
  const page = parsePositiveInteger(rawPage ?? undefined, 1);
  const pageSize = parsePositiveInteger(rawPageSize ?? undefined, 25);
  if (
    !listSortModes.has(sortMode) ||
    !listSortDirections.has(sortDirection) ||
    page === null ||
    pageSize === null ||
    !listPageSizes.has(pageSize)
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    value: {
      ...filters.value,
      sortMode: sortMode as WasteCollectionLocationQuery['sortMode'],
      sortDirection: sortDirection as WasteCollectionLocationQuery['sortDirection'],
      page,
      pageSize: pageSize as WasteCollectionLocationPageSize,
    },
  };
};

export const parseWasteCollectionLocationSelectionFilter = (
  request: Request
): ParsedLocationQuery<WasteCollectionLocationSelectionFilter> =>
  parseCollectionLocationFilters(request, listFilterKeys);

const authorizeCollectionLocationRead = async (
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps,
  requestId: string | undefined
): Promise<string | Response> => {
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.read',
    deps,
    requestId
  );
  if (authError) return authError;
  return requireActorInstanceId(ctx, requestId);
};

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
  getWasteManagementCollectionLocationsInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const instanceId = await authorizeCollectionLocationRead(ctx, deps, requestId);
    if (instanceId instanceof Response) return instanceId;
    const parsed = parseWasteCollectionLocationQuery(request);
    if (!parsed.ok) {
      return createApiError(
        400,
        'invalid_request',
        'Die Parameter der Abholortliste sind ungültig.',
        requestId
      );
    }
    try {
      const page = await requireDeps(
        deps.loadWasteCollectionLocationPage,
        'loadWasteCollectionLocationPage'
      )(instanceId, parsed.value);
      return createJsonApiItemResponse(page, requestId);
    } catch (error) {
      logWasteReadFailure(
        'get_waste_management_collection_locations',
        'Waste collection-location page failed',
        instanceId,
        error
      );
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Abholorte konnten nicht geladen werden.',
        requestId
      );
    }
  },
  getWasteManagementCollectionLocationIdsInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const instanceId = await authorizeCollectionLocationRead(ctx, deps, requestId);
    if (instanceId instanceof Response) return instanceId;
    const parsed = parseWasteCollectionLocationSelectionFilter(request);
    if (!parsed.ok) {
      return createApiError(
        400,
        'invalid_request',
        'Die Filterparameter der Abholortauswahl sind ungültig.',
        requestId
      );
    }
    try {
      const ids = await requireDeps(
        deps.loadWasteCollectionLocationIds,
        'loadWasteCollectionLocationIds'
      )(instanceId, parsed.value);
      return createJsonApiItemResponse({ ids }, requestId);
    } catch (error) {
      logWasteReadFailure(
        'get_waste_management_collection_location_ids',
        'Waste collection-location ids failed',
        instanceId,
        error
      );
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Abholortauswahl konnte nicht geladen werden.',
        requestId
      );
    }
  },
  createWasteManagementCollectionLocationInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationRequest(request, ctx, deps);
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId } = authorized;

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
        requireDeps(deps.loadWasteCollectionLocationById, 'loadWasteCollectionLocationById')(
          instanceId,
          parsed.data.id
        ),
    });
  },
  updateWasteManagementCollectionLocationInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationPathRequest(request, ctx, deps, {
      resourceIdName: 'locationId',
    });
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId, resourceId: locationId } = authorized;

    const parsed = await parseRequestBody(request, updateWasteCollectionLocationSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const loadCollectionLocation = requireDeps(
      deps.loadWasteCollectionLocationById,
      'loadWasteCollectionLocationById'
    );
    const saveCollectionLocation = requireDeps(
      deps.saveWasteCollectionLocation,
      'saveWasteCollectionLocation'
    );

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
      save: () =>
        saveCollectionLocation(instanceId, toCollectionLocationInput(locationId, parsed.data)),
      loadSaved: () => loadCollectionLocation(instanceId, locationId),
    });
  },
  deleteWasteManagementCollectionLocationInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationPathRequest(request, ctx, deps, {
      resourceIdName: 'locationId',
    });
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId, resourceId: locationId } = authorized;

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
