import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, getAuthorizedWasteManagementInstanceId } from './auth.js';
import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireDeps } from './utils.js';

const { createWasteStreetSchema, updateWasteStreetSchema } = wasteManagementMasterDataSchemas;

export const wasteManagementStreetHandlers = {
  createWasteManagementStreetInternal: async (
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

    const parsed = await parseRequestBody(request, createWasteStreetSchema);
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
        actionId: 'waste-management.street.created',
        resourceType: 'waste_street',
      },
      messages: {
        verificationFailed: 'Die Waste-Straße konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Straße konnte nicht gespeichert werden.',
      },
      save: () =>
        requireDeps(deps.saveWasteStreet, 'saveWasteStreet')(instanceId, {
          id: parsed.data.id,
          name: parsed.data.name.trim(),
          cityId: parsed.data.cityId,
        }),
      loadSaved: () => requireDeps(deps.loadWasteStreetById, 'loadWasteStreetById')(instanceId, parsed.data.id),
    });
  },
  updateWasteManagementStreetInternal: async (
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

    const streetId = readPathSegment(request, 4)?.trim();
    if (!streetId) {
      return createApiError(400, 'invalid_request', 'streetId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteStreetSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const loadWasteStreet = requireDeps(deps.loadWasteStreetById, 'loadWasteStreetById');

    return runWasteUpdateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: streetId,
      audit: {
        actionId: 'waste-management.street.updated',
        resourceType: 'waste_street',
      },
      messages: {
        notFound: 'Die Waste-Straße wurde nicht gefunden.',
        verificationFailed: 'Die Waste-Straße konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Straße konnte nicht gespeichert werden.',
      },
      loadExisting: () => loadWasteStreet(instanceId, streetId),
      save: () =>
        requireDeps(deps.saveWasteStreet, 'saveWasteStreet')(instanceId, {
          id: streetId,
          name: parsed.data.name.trim(),
          cityId: parsed.data.cityId,
        }),
      loadSaved: () => loadWasteStreet(instanceId, streetId),
    });
  },
};
