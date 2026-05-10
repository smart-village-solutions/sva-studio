import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const { createWasteStreetSchema, updateWasteStreetSchema } = wasteManagementMasterDataSchemas;

export const wasteManagementStreetHandlers = {
  createWasteManagementStreetInternal: async (
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

    const parsed = await parseRequestBody(request, createWasteStreetSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      await requireDeps(deps.saveWasteStreet, 'saveWasteStreet')(instanceId, {
        id: parsed.data.id,
        name: parsed.data.name.trim(),
        cityId: parsed.data.cityId,
      });

      const saved = await requireDeps(deps.loadWasteStreetById, 'loadWasteStreetById')(instanceId, parsed.data.id);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.street.created',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_street',
          resourceId: parsed.data.id,
        });
        return createApiError(503, 'database_unavailable', 'Die Waste-Straße konnte nicht verifiziert werden.', requestId);
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.street.created',
        result: 'success',
        resourceType: 'waste_street',
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
        actionId: 'waste-management.street.created',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_street',
        resourceId: parsed.data.id,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Straße konnte nicht gespeichert werden.', requestId);
    }
  },
  updateWasteManagementStreetInternal: async (
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

    const streetId = readPathSegment(request, 4)?.trim();
    if (!streetId) {
      return createApiError(400, 'invalid_request', 'streetId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteStreetSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const existing = await requireDeps(deps.loadWasteStreetById, 'loadWasteStreetById')(instanceId, streetId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Die Waste-Straße wurde nicht gefunden.', requestId);
      }

      await requireDeps(deps.saveWasteStreet, 'saveWasteStreet')(instanceId, {
        id: streetId,
        name: parsed.data.name.trim(),
        cityId: parsed.data.cityId,
      });

      const saved = await requireDeps(deps.loadWasteStreetById, 'loadWasteStreetById')(instanceId, streetId);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.street.updated',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_street',
          resourceId: streetId,
        });
        return createApiError(503, 'database_unavailable', 'Die Waste-Straße konnte nicht verifiziert werden.', requestId);
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.street.updated',
        result: 'success',
        resourceType: 'waste_street',
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
        actionId: 'waste-management.street.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_street',
        resourceId: streetId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Straße konnte nicht gespeichert werden.', requestId);
    }
  },
};
