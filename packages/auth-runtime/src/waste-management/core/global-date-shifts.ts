import type { WasteDateShiftReasonType } from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementTourSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, normalizeOptionalString, requireActorInstanceId, requireDeps } from './utils.js';

const { createWasteGlobalDateShiftSchema, updateWasteGlobalDateShiftSchema } = wasteManagementTourSchemas;

const toGlobalDateShiftInput = (
  id: string,
  data: {
    originalDate: string;
    actualDate: string;
    hasYear: boolean;
    reasonType?: WasteDateShiftReasonType;
    reasonKey?: string;
    description?: string;
    tourIds?: readonly string[];
  }
) => ({
  id,
  originalDate: data.originalDate,
  actualDate: data.actualDate,
  hasYear: data.hasYear,
  reasonType: data.reasonType,
  reasonKey: normalizeOptionalString(data.reasonKey),
  description: normalizeOptionalString(data.description),
  tourIds: data.tourIds?.length ? data.tourIds.map((value) => value.trim()) : undefined,
});

export const wasteManagementGlobalDateShiftHandlers = {
  createWasteManagementGlobalDateShiftInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
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

    const parsed = await parseRequestBody(request, createWasteGlobalDateShiftSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      await requireDeps(deps.saveWasteGlobalDateShift, 'saveWasteGlobalDateShift')(
        instanceId,
        toGlobalDateShiftInput(parsed.data.id, parsed.data)
      );

      const saved = await requireDeps(deps.loadWasteGlobalDateShiftById, 'loadWasteGlobalDateShiftById')(
        instanceId,
        parsed.data.id
      );
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.global-date-shift.created',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_global_date_shift',
          resourceId: parsed.data.id,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Der globale Waste-Ausweichtermin konnte nicht verifiziert werden.',
          requestId
        );
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.global-date-shift.created',
        result: 'success',
        resourceType: 'waste_global_date_shift',
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
        actionId: 'waste-management.global-date-shift.created',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_global_date_shift',
        resourceId: parsed.data.id,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(
        503,
        'database_unavailable',
        'Der globale Waste-Ausweichtermin konnte nicht gespeichert werden.',
        requestId
      );
    }
  },
  updateWasteManagementGlobalDateShiftInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const shiftId = readPathSegment(request, 4)?.trim();
    if (!shiftId) {
      return createApiError(400, 'invalid_request', 'shiftId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteGlobalDateShiftSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const loadGlobalDateShift = requireDeps(deps.loadWasteGlobalDateShiftById, 'loadWasteGlobalDateShiftById');
      const saveGlobalDateShift = requireDeps(deps.saveWasteGlobalDateShift, 'saveWasteGlobalDateShift');
      const existing = await loadGlobalDateShift(instanceId, shiftId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Der globale Waste-Ausweichtermin wurde nicht gefunden.', requestId);
      }

      await saveGlobalDateShift(instanceId, toGlobalDateShiftInput(shiftId, parsed.data));

      const saved = await loadGlobalDateShift(instanceId, shiftId);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.global-date-shift.updated',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_global_date_shift',
          resourceId: shiftId,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Der globale Waste-Ausweichtermin konnte nicht verifiziert werden.',
          requestId
        );
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.global-date-shift.updated',
        result: 'success',
        resourceType: 'waste_global_date_shift',
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
        actionId: 'waste-management.global-date-shift.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_global_date_shift',
        resourceId: shiftId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(
        503,
        'database_unavailable',
        'Der globale Waste-Ausweichtermin konnte nicht gespeichert werden.',
        requestId
      );
    }
  },
};
