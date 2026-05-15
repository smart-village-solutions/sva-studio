import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction } from './auth.js';
import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const { createWasteRegionSchema, updateWasteRegionSchema } = wasteManagementMasterDataSchemas;

export const wasteManagementRegionHandlers = {
  createWasteManagementRegionInternal: async (
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
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const regionId = readPathSegment(request, 4)?.trim();
    if (!regionId) {
      return createApiError(400, 'invalid_request', 'regionId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

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
