import type { WasteDateShiftReasonType, WasteTourDateShiftFollowUpMode } from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementTourSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, normalizeOptionalString, requireActorInstanceId, requireDeps } from './utils.js';

const { createWasteTourDateShiftSchema, updateWasteTourDateShiftSchema } = wasteManagementTourSchemas;

const toTourDateShiftInput = (
  id: string,
  data: {
    tourId: string;
    originalDate: string;
    actualDate: string;
    hasYear: boolean;
    reasonType?: WasteDateShiftReasonType;
    reasonKey?: string;
    followUpMode?: WasteTourDateShiftFollowUpMode;
    description?: string;
  }
) => ({
  id,
  tourId: data.tourId,
  originalDate: data.originalDate,
  actualDate: data.actualDate,
  hasYear: data.hasYear,
  reasonType: data.reasonType,
  reasonKey: normalizeOptionalString(data.reasonKey),
  followUpMode: data.followUpMode,
  description: normalizeOptionalString(data.description),
});

export const wasteManagementTourDateShiftHandlers = {
  createWasteManagementTourDateShiftInternal: async (
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

    const parsed = await parseRequestBody(request, createWasteTourDateShiftSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      await requireDeps(deps.saveWasteTourDateShift, 'saveWasteTourDateShift')(
        instanceId,
        toTourDateShiftInput(parsed.data.id, parsed.data)
      );

      const saved = await requireDeps(deps.loadWasteTourDateShiftById, 'loadWasteTourDateShiftById')(
        instanceId,
        parsed.data.id
      );
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.tour-date-shift.created',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_tour_date_shift',
          resourceId: parsed.data.id,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Der tourbezogene Waste-Ausweichtermin konnte nicht verifiziert werden.',
          requestId
        );
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour-date-shift.created',
        result: 'success',
        resourceType: 'waste_tour_date_shift',
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
        actionId: 'waste-management.tour-date-shift.created',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_tour_date_shift',
        resourceId: parsed.data.id,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(
        503,
        'database_unavailable',
        'Der tourbezogene Waste-Ausweichtermin konnte nicht gespeichert werden.',
        requestId
      );
    }
  },
  updateWasteManagementTourDateShiftInternal: async (
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

    const parsed = await parseRequestBody(request, updateWasteTourDateShiftSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const existing = await requireDeps(deps.loadWasteTourDateShiftById, 'loadWasteTourDateShiftById')(instanceId, shiftId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Der tourbezogene Waste-Ausweichtermin wurde nicht gefunden.', requestId);
      }

      await requireDeps(deps.saveWasteTourDateShift, 'saveWasteTourDateShift')(
        instanceId,
        toTourDateShiftInput(shiftId, parsed.data)
      );

      const saved = await requireDeps(deps.loadWasteTourDateShiftById, 'loadWasteTourDateShiftById')(instanceId, shiftId);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.tour-date-shift.updated',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_tour_date_shift',
          resourceId: shiftId,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Der tourbezogene Waste-Ausweichtermin konnte nicht verifiziert werden.',
          requestId
        );
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour-date-shift.updated',
        result: 'success',
        resourceType: 'waste_tour_date_shift',
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
        actionId: 'waste-management.tour-date-shift.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_tour_date_shift',
        resourceId: shiftId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(
        503,
        'database_unavailable',
        'Der tourbezogene Waste-Ausweichtermin konnte nicht gespeichert werden.',
        requestId
      );
    }
  },
};
