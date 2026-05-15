import type { WasteDateShiftReasonType, WasteTourDateShiftFollowUpMode } from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction } from './auth.js';
import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementTourSchemas } from './schemas.js';
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

    return runWasteCreateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: parsed.data.id,
      audit: {
        actionId: 'waste-management.tour-date-shift.created',
        resourceType: 'waste_tour_date_shift',
      },
      messages: {
        verificationFailed: 'Der tourbezogene Waste-Ausweichtermin konnte nicht verifiziert werden.',
        persistenceFailed: 'Der tourbezogene Waste-Ausweichtermin konnte nicht gespeichert werden.',
      },
      save: () =>
        requireDeps(deps.saveWasteTourDateShift, 'saveWasteTourDateShift')(
          instanceId,
          toTourDateShiftInput(parsed.data.id, parsed.data)
        ),
      loadSaved: () =>
        requireDeps(deps.loadWasteTourDateShiftById, 'loadWasteTourDateShiftById')(instanceId, parsed.data.id),
    });
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

    const loadTourDateShift = requireDeps(deps.loadWasteTourDateShiftById, 'loadWasteTourDateShiftById');
    const saveTourDateShift = requireDeps(deps.saveWasteTourDateShift, 'saveWasteTourDateShift');

    return runWasteUpdateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: shiftId,
      audit: {
        actionId: 'waste-management.tour-date-shift.updated',
        resourceType: 'waste_tour_date_shift',
      },
      messages: {
        notFound: 'Der tourbezogene Waste-Ausweichtermin wurde nicht gefunden.',
        verificationFailed: 'Der tourbezogene Waste-Ausweichtermin konnte nicht verifiziert werden.',
        persistenceFailed: 'Der tourbezogene Waste-Ausweichtermin konnte nicht gespeichert werden.',
      },
      loadExisting: () => loadTourDateShift(instanceId, shiftId),
      save: () => saveTourDateShift(instanceId, toTourDateShiftInput(shiftId, parsed.data)),
      loadSaved: () => loadTourDateShift(instanceId, shiftId),
    });
  },
};
