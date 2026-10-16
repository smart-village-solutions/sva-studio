import type { AuthenticatedRequestContext } from './types.js';
import { createApiError, parseRequestBody } from '@sva/server-runtime';
import {
  authorizeWasteMasterDataMutationPathRequest,
  authorizeWasteMasterDataMutationRequest,
} from './master-data-request-guards.js';
import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementMasterDataSchemas } from '../http-schemas.js';
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
    const existingHouseNumber = await loadWasteHouseNumber(instanceId, houseNumberId);
    if (!existingHouseNumber) return createApiError(404, 'not_found', 'Die Waste-Hausnummer wurde nicht gefunden.', requestId);
    const movesStreet = existingHouseNumber.streetId !== parsed.data.streetId;

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
        mapPersistenceError: (error) => {
          const message = error instanceof Error ? error.message : '';
          const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
          if (message === 'address_confirmation_required') return { status: 409, code: 'conflict', message: 'Bitte laden Sie die Folgen des Elternwechsels und bestätigen Sie die betroffenen E-Mail-Abos ausdrücklich.', reasonCode: message };
          if (code === '40001' || code === '40P01') return { status: 409, code: 'conflict', message: 'Die Adressdaten wurden gleichzeitig geändert. Bitte laden Sie die Vorschau erneut.', reasonCode: 'address_preview_stale' };
          if (message === 'address_preview_stale' || message === 'address_data_inconsistent') return { status: 409, code: 'conflict', message: 'Die Vorschau ist nicht mehr aktuell oder die Adressdaten sind widersprüchlich. Bitte laden Sie die Vorschau erneut.', reasonCode: message };
          return undefined;
        },
      },
      loadExisting: () => loadWasteHouseNumber(instanceId, houseNumberId),
      save: () => {
        if (movesStreet) {
          if (!parsed.data.confirmationToken) return Promise.reject(new Error('address_confirmation_required'));
          return requireDeps(deps.mutateWasteAddressInTransaction, 'mutateWasteAddressInTransaction')(
            instanceId,
            { entityType: 'houseNumber', entityId: houseNumberId, mode: 'move', targetParentId: parsed.data.streetId, confirmationToken: parsed.data.confirmationToken, number: parsed.data.number.trim() }
          ).then(() => undefined);
        }
        return requireDeps(deps.saveWasteHouseNumber, 'saveWasteHouseNumber')(instanceId, {
          id: houseNumberId,
          number: parsed.data.number.trim(),
          streetId: parsed.data.streetId,
        });
      },
      loadSaved: () => loadWasteHouseNumber(instanceId, houseNumberId),
    });
  },
};
