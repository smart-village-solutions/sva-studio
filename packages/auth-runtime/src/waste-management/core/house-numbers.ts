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

const { createWasteHouseNumberSchema, updateWasteHouseNumberSchema } = wasteManagementMasterDataSchemas;

export const wasteManagementHouseNumberHandlers = {
  createWasteManagementHouseNumberInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationRequest(request, ctx, deps);
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId } = authorized;

    const parsed = await parseRequestBody(request, createWasteHouseNumberSchema);
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
        actionId: 'waste-management.house-number.created',
        resourceType: 'waste_house_number',
      },
      messages: {
        verificationFailed: 'Die Waste-Hausnummer konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Hausnummer konnte nicht gespeichert werden.',
      },
      save: () =>
        requireDeps(deps.saveWasteHouseNumber, 'saveWasteHouseNumber')(instanceId, {
          id: parsed.data.id,
          number: parsed.data.number.trim(),
          streetId: parsed.data.streetId,
        }),
      loadSaved: () =>
        requireDeps(deps.loadWasteHouseNumberById, 'loadWasteHouseNumberById')(instanceId, parsed.data.id),
    });
  },
  updateWasteManagementHouseNumberInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const authorized = await authorizeWasteMasterDataMutationPathRequest(request, ctx, deps, {
      resourceIdName: 'houseNumberId',
    });
    if (authorized instanceof Response) {
      return authorized;
    }
    const { instanceId, requestId, resourceId: houseNumberId } = authorized;

    const parsed = await parseRequestBody(request, updateWasteHouseNumberSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const loadWasteHouseNumber = requireDeps(deps.loadWasteHouseNumberById, 'loadWasteHouseNumberById');

    return runWasteUpdateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: houseNumberId,
      audit: {
        actionId: 'waste-management.house-number.updated',
        resourceType: 'waste_house_number',
      },
      messages: {
        notFound: 'Die Waste-Hausnummer wurde nicht gefunden.',
        verificationFailed: 'Die Waste-Hausnummer konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Hausnummer konnte nicht gespeichert werden.',
      },
      loadExisting: () => loadWasteHouseNumber(instanceId, houseNumberId),
      save: () =>
        requireDeps(deps.saveWasteHouseNumber, 'saveWasteHouseNumber')(instanceId, {
          id: houseNumberId,
          number: parsed.data.number.trim(),
          streetId: parsed.data.streetId,
        }),
      loadSaved: () => loadWasteHouseNumber(instanceId, houseNumberId),
    });
  },
};
