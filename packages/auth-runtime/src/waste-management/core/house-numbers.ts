import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction } from './auth.js';
import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const { createWasteHouseNumberSchema, updateWasteHouseNumberSchema } = wasteManagementMasterDataSchemas;

export const wasteManagementHouseNumberHandlers = {
  createWasteManagementHouseNumberInternal: async (
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
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const houseNumberId = readPathSegment(request, 4)?.trim();
    if (!houseNumberId) {
      return createApiError(400, 'invalid_request', 'houseNumberId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

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
