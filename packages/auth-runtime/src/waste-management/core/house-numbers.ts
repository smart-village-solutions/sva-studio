import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
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

    try {
      await requireDeps(deps.saveWasteHouseNumber, 'saveWasteHouseNumber')(instanceId, {
        id: parsed.data.id,
        number: parsed.data.number.trim(),
        streetId: parsed.data.streetId,
      });

      const saved = await requireDeps(deps.loadWasteHouseNumberById, 'loadWasteHouseNumberById')(instanceId, parsed.data.id);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.house-number.created',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_house_number',
          resourceId: parsed.data.id,
        });
        return createApiError(503, 'database_unavailable', 'Die Waste-Hausnummer konnte nicht verifiziert werden.', requestId);
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.house-number.created',
        result: 'success',
        resourceType: 'waste_house_number',
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
        actionId: 'waste-management.house-number.created',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_house_number',
        resourceId: parsed.data.id,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Hausnummer konnte nicht gespeichert werden.', requestId);
    }
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

    try {
      const existing = await requireDeps(deps.loadWasteHouseNumberById, 'loadWasteHouseNumberById')(instanceId, houseNumberId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Die Waste-Hausnummer wurde nicht gefunden.', requestId);
      }

      await requireDeps(deps.saveWasteHouseNumber, 'saveWasteHouseNumber')(instanceId, {
        id: houseNumberId,
        number: parsed.data.number.trim(),
        streetId: parsed.data.streetId,
      });

      const saved = await requireDeps(deps.loadWasteHouseNumberById, 'loadWasteHouseNumberById')(instanceId, houseNumberId);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.house-number.updated',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_house_number',
          resourceId: houseNumberId,
        });
        return createApiError(503, 'database_unavailable', 'Die Waste-Hausnummer konnte nicht verifiziert werden.', requestId);
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.house-number.updated',
        result: 'success',
        resourceType: 'waste_house_number',
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
        actionId: 'waste-management.house-number.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_house_number',
        resourceId: houseNumberId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Hausnummer konnte nicht gespeichert werden.', requestId);
    }
  },
};
