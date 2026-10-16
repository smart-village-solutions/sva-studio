import type { AuthenticatedRequestContext } from './types.js';
import { createApiError, parseRequestBody } from '@sva/server-runtime';
import {
  authorizeWasteMasterDataMutationPathRequest,
  authorizeWasteMasterDataMutationRequest,
} from './master-data-request-guards.js';
import { mapWasteAddressMutationPersistenceError, runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from '../http-schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { normalizeOptionalString, requireDeps } from './utils.js';

const { createWasteCitySchema, updateWasteCitySchema } = wasteManagementMasterDataSchemas;
type CityUpdateInput = typeof updateWasteCitySchema._output;

const saveCityUpdate = (
  deps: WasteManagementHandlerDeps,
  instanceId: string,
  cityId: string,
  nextRegionId: string | null,
  movesRegion: boolean,
  data: CityUpdateInput
): (() => Promise<void>) => async () => {
  if (!movesRegion) {
    await requireDeps(deps.patchWasteCity, 'patchWasteCity')(instanceId, cityId, {
      ...(data.name === undefined ? {} : { name: data.name.trim() }),
      ...(data.postalCode === undefined ? {} : { postalCode: normalizeOptionalString(data.postalCode ?? undefined) ?? null }),
      ...(data.regionId === undefined ? {} : { regionId: normalizeOptionalString(data.regionId ?? undefined) ?? null }),
    });
    return;
  }
  if (!data.confirmationToken) throw new Error('address_confirmation_required');
  await requireDeps(deps.mutateWasteAddressInTransaction, 'mutateWasteAddressInTransaction')(
    instanceId,
    {
      entityType: 'city', entityId: cityId, mode: 'move', targetParentId: nextRegionId ?? undefined,
      confirmationToken: data.confirmationToken,
      ...(data.name === undefined ? {} : { name: data.name.trim() }),
      ...(data.postalCode === undefined ? {} : { postalCode: normalizeOptionalString(data.postalCode ?? undefined) ?? null }),
    }
  );
};

export const wasteManagementCityHandlers = {
  createWasteManagementCityInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationRequest(request, ctx, deps);
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId } = authorized;

    const parsed = await parseRequestBody(request, createWasteCitySchema);
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
        actionId: 'waste-management.city.created',
        resourceType: 'waste_city',
      },
      messages: {
        verificationFailed: 'Die Waste-Stadt konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Stadt konnte nicht gespeichert werden.',
      },
      save: () =>
        requireDeps(deps.saveWasteCity, 'saveWasteCity')(instanceId, {
          id: parsed.data.id,
          name: parsed.data.name.trim(),
          postalCode: normalizeOptionalString(parsed.data.postalCode),
          regionId: normalizeOptionalString(parsed.data.regionId),
        }),
      loadSaved: () =>
        requireDeps(deps.loadWasteCityById, 'loadWasteCityById')(instanceId, parsed.data.id),
    });
  },
  updateWasteManagementCityInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationPathRequest(request, ctx, deps, {
      resourceIdName: 'cityId',
    });
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId, resourceId: cityId } = authorized;

    const parsed = await parseRequestBody(request, updateWasteCitySchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const loadWasteCity = requireDeps(deps.loadWasteCityById, 'loadWasteCityById');
    const existingCity = await loadWasteCity(instanceId, cityId);
    if (!existingCity) return createApiError(404, 'not_found', 'Die Waste-Stadt wurde nicht gefunden.', requestId);
    const nextRegionId = parsed.data.regionId === undefined
      ? existingCity.regionId ?? null
      : normalizeOptionalString(parsed.data.regionId ?? undefined) ?? null;
    const movesRegion = (existingCity.regionId ?? null) !== nextRegionId;

    return runWasteUpdateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: cityId,
      audit: {
        actionId: 'waste-management.city.updated',
        resourceType: 'waste_city',
      },
      messages: {
        notFound: 'Die Waste-Stadt wurde nicht gefunden.',
        verificationFailed: 'Die Waste-Stadt konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Stadt konnte nicht gespeichert werden.',
        mapPersistenceError: mapWasteAddressMutationPersistenceError,
      },
      loadExisting: async () => existingCity,
      save: saveCityUpdate(deps, instanceId, cityId, nextRegionId, movesRegion, parsed.data),
      loadSaved: () => loadWasteCity(instanceId, cityId),
    });
  },
};
