import type { AuthenticatedRequestContext } from '../../middleware.js';
import { createApiError, parseRequestBody } from '../../shared/request-helpers.js';
import {
  authorizeWasteMasterDataMutationPathRequest,
  authorizeWasteMasterDataMutationRequest,
} from './master-data-request-guards.js';
import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { requireDeps } from './utils.js';

const { createWasteStreetSchema, updateWasteStreetSchema } = wasteManagementMasterDataSchemas;

export const wasteManagementStreetHandlers = {
  createWasteManagementStreetInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationRequest(request, ctx, deps);
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId } = authorized;

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
    const authorized = await authorizeWasteMasterDataMutationPathRequest(request, ctx, deps, {
      resourceIdName: 'streetId',
    });
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId, resourceId: streetId } = authorized;

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
