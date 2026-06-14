import type { AuthenticatedRequestContext } from '../../middleware.js';
import { createApiError, parseRequestBody } from '../../shared/request-helpers.js';
import {
  authorizeWasteMasterDataMutationPathRequest,
  authorizeWasteMasterDataMutationRequest,
} from './master-data-request-guards.js';
import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
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
          regionId: normalizeOptionalString(parsed.data.regionId),
        }),
      loadSaved: () => requireDeps(deps.loadWasteCityById, 'loadWasteCityById')(instanceId, parsed.data.id),
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
      },
      loadExisting: () => loadWasteCity(instanceId, cityId),
      save: () =>
        requireDeps(deps.saveWasteCity, 'saveWasteCity')(instanceId, {
          id: cityId,
          name: parsed.data.name.trim(),
          regionId: normalizeOptionalString(parsed.data.regionId),
        }),
      loadSaved: () => loadWasteCity(instanceId, cityId),
    });
  },
};
