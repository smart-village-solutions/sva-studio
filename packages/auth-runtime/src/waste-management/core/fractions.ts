import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementMasterDataSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, normalizeOptionalString, requireActorInstanceId, requireDeps } from './utils.js';

const { createWasteFractionSchema, updateWasteFractionSchema } = wasteManagementMasterDataSchemas;

export const wasteManagementFractionHandlers = {
  createWasteManagementFractionInternal: async (
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

    const parsed = await parseRequestBody(request, createWasteFractionSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      await requireDeps(deps.saveWasteFraction, 'saveWasteFraction')(instanceId, {
        id: parsed.data.id,
        name: parsed.data.name.trim(),
        translations: parsed.data.translations,
        containerSize: normalizeOptionalString(parsed.data.containerSize),
        color: parsed.data.color,
        description: normalizeOptionalString(parsed.data.description),
        active: parsed.data.active,
      });

      const saved = await requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById')(instanceId, parsed.data.id);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.fraction.created',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_fraction',
          resourceId: parsed.data.id,
        });
        return createApiError(503, 'database_unavailable', 'Die Waste-Fraktion konnte nicht verifiziert werden.', requestId);
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.fraction.created',
        result: 'success',
        resourceType: 'waste_fraction',
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
        actionId: 'waste-management.fraction.created',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_fraction',
        resourceId: parsed.data.id,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Fraktion konnte nicht gespeichert werden.', requestId);
    }
  },
  updateWasteManagementFractionInternal: async (
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

    const fractionId = readPathSegment(request, 4)?.trim();
    if (!fractionId) {
      return createApiError(400, 'invalid_request', 'fractionId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteFractionSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const existing = await requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById')(instanceId, fractionId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Die Waste-Fraktion wurde nicht gefunden.', requestId);
      }

      await requireDeps(deps.saveWasteFraction, 'saveWasteFraction')(instanceId, {
        id: fractionId,
        name: parsed.data.name.trim(),
        translations: parsed.data.translations,
        containerSize: normalizeOptionalString(parsed.data.containerSize),
        color: parsed.data.color,
        description: normalizeOptionalString(parsed.data.description),
        active: parsed.data.active,
      });

      const saved = await requireDeps(deps.loadWasteFractionById, 'loadWasteFractionById')(instanceId, fractionId);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.fraction.updated',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_fraction',
          resourceId: fractionId,
        });
        return createApiError(503, 'database_unavailable', 'Die Waste-Fraktion konnte nicht verifiziert werden.', requestId);
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.fraction.updated',
        result: 'success',
        resourceType: 'waste_fraction',
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
        actionId: 'waste-management.fraction.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_fraction',
        resourceId: fractionId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Fraktion konnte nicht gespeichert werden.', requestId);
    }
  },
};
