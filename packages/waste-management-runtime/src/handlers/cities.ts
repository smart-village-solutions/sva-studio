import type { AuthenticatedRequestContext } from './types.js';
import { createApiError, parseRequestBody } from '@sva/server-runtime';
import {
  authorizeWasteMasterDataMutationPathRequest,
  authorizeWasteMasterDataMutationRequest,
} from './master-data-request-guards.js';
import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from '../http-schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { normalizeOptionalString, requireDeps } from './utils.js';

const { createWasteCitySchema, updateWasteCitySchema } = wasteManagementMasterDataSchemas;

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
        mapPersistenceError: (error) => {
          const message = error instanceof Error ? error.message : '';
          const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
          if (message === 'address_confirmation_required') return { status: 409, code: 'conflict', message: 'Bitte laden Sie die Folgen des Elternwechsels und bestätigen Sie die betroffenen E-Mail-Abos ausdrücklich.', reasonCode: message };
          if (code === '40001' || code === '40P01') return { status: 409, code: 'conflict', message: 'Die Adressdaten wurden gleichzeitig geändert. Bitte laden Sie die Vorschau erneut.', reasonCode: 'address_preview_stale' };
          if (message === 'address_preview_stale' || message === 'address_data_inconsistent') return { status: 409, code: 'conflict', message: 'Die Vorschau ist nicht mehr aktuell oder die Adressdaten sind widersprüchlich. Bitte laden Sie die Vorschau erneut.', reasonCode: message };
          return undefined;
        },
      },
      loadExisting: () => loadWasteCity(instanceId, cityId),
      save: () => {
        if (movesRegion) {
          if (!parsed.data.confirmationToken) return Promise.reject(new Error('address_confirmation_required'));
          return requireDeps(deps.mutateWasteAddressInTransaction, 'mutateWasteAddressInTransaction')(
            instanceId,
            {
              entityType: 'city', entityId: cityId, mode: 'move', targetParentId: nextRegionId ?? undefined,
              confirmationToken: parsed.data.confirmationToken,
              ...(parsed.data.name === undefined ? {} : { name: parsed.data.name.trim() }),
              ...(parsed.data.postalCode === undefined ? {} : { postalCode: normalizeOptionalString(parsed.data.postalCode ?? undefined) ?? null }),
            }
          ).then(() => undefined);
        }
        return requireDeps(deps.patchWasteCity, 'patchWasteCity')(instanceId, cityId, {
          ...(parsed.data.name === undefined ? {} : { name: parsed.data.name.trim() }),
          ...(parsed.data.postalCode === undefined
            ? {}
            : { postalCode: normalizeOptionalString(parsed.data.postalCode ?? undefined) ?? null }),
          ...(parsed.data.regionId === undefined
            ? {}
            : { regionId: normalizeOptionalString(parsed.data.regionId ?? undefined) ?? null }),
        });
      },
      loadSaved: () => loadWasteCity(instanceId, cityId),
    });
  },
};
