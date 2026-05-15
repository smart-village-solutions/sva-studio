import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction } from './auth.js';
import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, normalizeOptionalString, requireActorInstanceId, requireDeps } from './utils.js';

const { createWasteCitySchema, updateWasteCitySchema } = wasteManagementMasterDataSchemas;

export const wasteManagementCityHandlers = {
  createWasteManagementCityInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
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
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const cityId = readPathSegment(request, 4)?.trim();
    if (!cityId) {
      return createApiError(400, 'invalid_request', 'cityId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

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
