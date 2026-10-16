import type { WasteAddressEntityType, WasteAddressMutationPreviewInput } from '@sva/waste-management-contracts';
import { asApiItem, createApiError, parseRequestBody } from '@sva/server-runtime';

import { authorizeWasteMasterDataMutationPathRequest, authorizeWasteMasterDataMutationRequest } from './master-data-request-guards.js';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';
import { emitWasteAuditEvent } from './auth.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import { requireDeps } from './utils.js';
import { wasteManagementMasterDataSchemas } from '../http-schemas.js';

const { wasteAddressDeleteSchema, wasteAddressMutationPreviewSchema } = wasteManagementMasterDataSchemas;

const mapMutationError = (error: unknown): Response => {
  const message = error instanceof Error ? error.message : '';
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';
  if (message === 'address_preview_stale' || message === 'address_data_inconsistent' || code === '40001' || code === '40P01') {
    return createApiError(409, 'conflict', message === 'address_preview_stale'
      ? 'Die Vorschau ist nicht mehr aktuell. Bitte laden Sie die Auswirkungen erneut.'
      : message === 'address_data_inconsistent'
        ? 'Die Adressdaten sind widersprüchlich. Es wurden keine Daten geändert.'
        : 'Die Adressdaten wurden gleichzeitig geändert. Bitte laden Sie die Auswirkungen erneut.');
  }
  if (message === 'address_entity_not_found' || message === 'address_move_target_not_found') {
    return createApiError(404, 'not_found', 'Der ausgewählte Adressdatensatz wurde nicht gefunden.');
  }
  if (message === 'address_move_unchanged' || message === 'invalid_address_move') {
    return createApiError(400, 'invalid_request', 'Die ausgewählte Zuordnung ist ungültig oder bereits gesetzt.');
  }
  return createApiError(503, 'database_unavailable', 'Die Adressänderung konnte nicht gespeichert werden.');
};

const isMissingDependency = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith('missing_dependency:');

export const createWasteAddressEntityImpactHandlers = (
  deps: WasteManagementHandlerDeps,
  withAuthenticatedWasteManagementHandler: (
    request: Request,
    handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
  ) => Promise<Response>
) => {
  const preview = (request: Request): Promise<Response> =>
    withAuthenticatedWasteManagementHandler(request, async (nextRequest, ctx) => {
      const authorized = await authorizeWasteMasterDataMutationRequest(nextRequest, ctx, deps);
      if (authorized instanceof Response) return authorized;
      const parsed = await parseRequestBody(nextRequest, wasteAddressMutationPreviewSchema);
      if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, authorized.requestId);
      try {
        const result = await requireDeps(deps.previewWasteAddressMutation, 'previewWasteAddressMutation')(
          authorized.instanceId,
          parsed.data as WasteAddressMutationPreviewInput
        );
        return Response.json(asApiItem(result, authorized.requestId));
      } catch (error) {
        if (isMissingDependency(error)) throw error;
        return mapMutationError(error);
      }
    });

  const remove = (entityType: WasteAddressEntityType, resourceIdName: string, actionId: string) =>
    (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, async (nextRequest, ctx) => {
        const authorized = await authorizeWasteMasterDataMutationPathRequest(nextRequest, ctx, deps, { resourceIdName });
        if (authorized instanceof Response) return authorized;
        const parsed = await parseRequestBody(nextRequest, wasteAddressDeleteSchema);
        if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, authorized.requestId);
        try {
          const counts = await requireDeps(deps.mutateWasteAddressInTransaction, 'mutateWasteAddressInTransaction')(
            authorized.instanceId,
            { entityType, entityId: authorized.resourceId, mode: 'delete', confirmationToken: parsed.data.confirmationToken }
          );
          await emitWasteAuditEvent({
            deps,
            ctx,
            instanceId: authorized.instanceId,
            actionId,
            result: 'success',
            resourceType: `waste_${entityType}`,
            resourceId: authorized.resourceId,
          });
          await updateWasteVisibleStatus(deps, authorized.instanceId, 'success');
          return Response.json(asApiItem({ counts }, authorized.requestId));
        } catch (error) {
          if (isMissingDependency(error)) throw error;
          return mapMutationError(error);
        }
      });

  return {
    previewWasteAddressMutation: preview,
    deleteRegion: remove('region', 'regionId', 'waste-management.region.deleted'),
    deleteCity: remove('city', 'cityId', 'waste-management.city.deleted'),
    deleteStreet: remove('street', 'streetId', 'waste-management.street.deleted'),
    deleteHouseNumber: remove('houseNumber', 'houseNumberId', 'waste-management.house-number.deleted'),
  };
};
