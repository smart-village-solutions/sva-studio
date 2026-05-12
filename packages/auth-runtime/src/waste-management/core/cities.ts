import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
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

    try {
      await requireDeps(deps.saveWasteCity, 'saveWasteCity')(instanceId, {
        id: parsed.data.id,
        name: parsed.data.name.trim(),
        regionId: normalizeOptionalString(parsed.data.regionId),
      });

      const saved = await requireDeps(deps.loadWasteCityById, 'loadWasteCityById')(instanceId, parsed.data.id);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.city.created',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_city',
          resourceId: parsed.data.id,
        });
        return createApiError(503, 'database_unavailable', 'Die Waste-Stadt konnte nicht verifiziert werden.', requestId);
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.city.created',
        result: 'success',
        resourceType: 'waste_city',
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
        actionId: 'waste-management.city.created',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_city',
        resourceId: parsed.data.id,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Stadt konnte nicht gespeichert werden.', requestId);
    }
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

    try {
      const existing = await requireDeps(deps.loadWasteCityById, 'loadWasteCityById')(instanceId, cityId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Die Waste-Stadt wurde nicht gefunden.', requestId);
      }

      await requireDeps(deps.saveWasteCity, 'saveWasteCity')(instanceId, {
        id: cityId,
        name: parsed.data.name.trim(),
        regionId: normalizeOptionalString(parsed.data.regionId),
      });

      const saved = await requireDeps(deps.loadWasteCityById, 'loadWasteCityById')(instanceId, cityId);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.city.updated',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_city',
          resourceId: cityId,
        });
        return createApiError(503, 'database_unavailable', 'Die Waste-Stadt konnte nicht verifiziert werden.', requestId);
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.city.updated',
        result: 'success',
        resourceType: 'waste_city',
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
        actionId: 'waste-management.city.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_city',
        resourceId: cityId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Stadt konnte nicht gespeichert werden.', requestId);
    }
  },
};
