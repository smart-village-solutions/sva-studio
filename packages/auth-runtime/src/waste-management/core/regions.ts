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

const { createWasteRegionSchema, updateWasteRegionSchema } = wasteManagementMasterDataSchemas;

export const wasteManagementRegionHandlers = {
  createWasteManagementRegionInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationRequest(request, ctx, deps);
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId } = authorized;

    const parsed = await parseRequestBody(request, createWasteRegionSchema);
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
        actionId: 'waste-management.region.created',
        resourceType: 'waste_region',
      },
      messages: {
        verificationFailed: 'Die Waste-Region konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Region konnte nicht gespeichert werden.',
      },
      save: () =>
        requireDeps(deps.saveWasteRegion, 'saveWasteRegion')(instanceId, {
          id: parsed.data.id,
          name: parsed.data.name.trim(),
        }),
      loadSaved: () => requireDeps(deps.loadWasteRegionById, 'loadWasteRegionById')(instanceId, parsed.data.id),
    });
  },
  updateWasteManagementRegionInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationPathRequest(request, ctx, deps, {
      resourceIdName: 'regionId',
    });
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId, resourceId: regionId } = authorized;

    const parsed = await parseRequestBody(request, updateWasteRegionSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const loadWasteRegion = requireDeps(deps.loadWasteRegionById, 'loadWasteRegionById');

    return runWasteUpdateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: regionId,
      audit: {
        actionId: 'waste-management.region.updated',
        resourceType: 'waste_region',
      },
      messages: {
        notFound: 'Die Waste-Region wurde nicht gefunden.',
        verificationFailed: 'Die Waste-Region konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Region konnte nicht gespeichert werden.',
      },
      loadExisting: () => loadWasteRegion(instanceId, regionId),
      save: () =>
        requireDeps(deps.saveWasteRegion, 'saveWasteRegion')(instanceId, {
          id: regionId,
          name: parsed.data.name.trim(),
        }),
      loadSaved: () => loadWasteRegion(instanceId, regionId),
    });
  },
};
