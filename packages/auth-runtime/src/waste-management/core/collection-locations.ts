import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent, getAuthorizedWasteManagementInstanceId } from './auth.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, normalizeOptionalString, requireDeps } from './utils.js';

const { createWasteCollectionLocationSchema, updateWasteCollectionLocationSchema } = wasteManagementMasterDataSchemas;

const toCollectionLocationInput = (
  id: string,
  data: {
    cityId: string;
    regionId?: string;
    streetId?: string;
    houseNumberId?: string;
    active: boolean;
  }
) => ({
  id,
  cityId: data.cityId,
  regionId: normalizeOptionalString(data.regionId),
  streetId: normalizeOptionalString(data.streetId),
  houseNumberId: normalizeOptionalString(data.houseNumberId),
  active: data.active,
});

export const wasteManagementCollectionLocationHandlers = {
  createWasteManagementCollectionLocationInternal: async (
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

    const parsed = await parseRequestBody(request, createWasteCollectionLocationSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      await requireDeps(deps.saveWasteCollectionLocation, 'saveWasteCollectionLocation')(
        instanceId,
        toCollectionLocationInput(parsed.data.id, parsed.data)
      );

      const saved = await requireDeps(
        deps.loadWasteCollectionLocationById,
        'loadWasteCollectionLocationById'
      )(instanceId, parsed.data.id);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.collection-location.created',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_collection_location',
          resourceId: parsed.data.id,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Der Waste-Abholort konnte nicht verifiziert werden.',
          requestId
        );
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.collection-location.created',
        result: 'success',
        resourceType: 'waste_collection_location',
        resourceId: saved.id,
      });

      await updateWasteVisibleStatus(deps, instanceId, 'success');
      return new Response(JSON.stringify(asApiItem(saved, requestId)), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.collection-location.created',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_collection_location',
        resourceId: parsed.data.id,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Der Waste-Abholort konnte nicht gespeichert werden.', requestId);
    }
  },
  updateWasteManagementCollectionLocationInternal: async (
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

    const locationId = readPathSegment(request, 4)?.trim();
    if (!locationId) {
      return createApiError(400, 'invalid_request', 'locationId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteCollectionLocationSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const loadCollectionLocation = requireDeps(
        deps.loadWasteCollectionLocationById,
        'loadWasteCollectionLocationById'
      );
      const saveCollectionLocation = requireDeps(deps.saveWasteCollectionLocation, 'saveWasteCollectionLocation');
      const existing = await loadCollectionLocation(instanceId, locationId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Der Waste-Abholort wurde nicht gefunden.', requestId);
      }

      await saveCollectionLocation(instanceId, toCollectionLocationInput(locationId, parsed.data));

      const saved = await loadCollectionLocation(instanceId, locationId);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.collection-location.updated',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_collection_location',
          resourceId: locationId,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Der Waste-Abholort konnte nicht verifiziert werden.',
          requestId
        );
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.collection-location.updated',
        result: 'success',
        resourceType: 'waste_collection_location',
        resourceId: saved.id,
      });

      await updateWasteVisibleStatus(deps, instanceId, 'success');
      return new Response(JSON.stringify(asApiItem(saved, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.collection-location.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_collection_location',
        resourceId: locationId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Der Waste-Abholort konnte nicht gespeichert werden.', requestId);
    }
  },
};
