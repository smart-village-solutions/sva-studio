import type { WasteDateShiftReasonType } from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction } from './auth.js';
import { runWasteCreateMutation, runWasteDeleteMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementTourSchemas } from './schemas.js';
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

    return runWasteCreateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: parsed.data.id,
      audit: {
        actionId: 'waste-management.global-date-shift.created',
        resourceType: 'waste_global_date_shift',
      },
      messages: {
        verificationFailed: 'Der globale Waste-Ausweichtermin konnte nicht verifiziert werden.',
        persistenceFailed: 'Der globale Waste-Ausweichtermin konnte nicht gespeichert werden.',
      },
      save: () =>
        requireDeps(deps.saveWasteGlobalDateShift, 'saveWasteGlobalDateShift')(
          instanceId,
          toGlobalDateShiftInput(parsed.data.id, parsed.data)
        ),
      loadSaved: () =>
        requireDeps(deps.loadWasteGlobalDateShiftById, 'loadWasteGlobalDateShiftById')(instanceId, parsed.data.id),
    });
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

    const loadGlobalDateShift = requireDeps(deps.loadWasteGlobalDateShiftById, 'loadWasteGlobalDateShiftById');
    const saveGlobalDateShift = requireDeps(deps.saveWasteGlobalDateShift, 'saveWasteGlobalDateShift');

    return runWasteUpdateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: shiftId,
      audit: {
        actionId: 'waste-management.global-date-shift.updated',
        resourceType: 'waste_global_date_shift',
      },
      messages: {
        notFound: 'Der globale Waste-Ausweichtermin wurde nicht gefunden.',
        verificationFailed: 'Der globale Waste-Ausweichtermin konnte nicht verifiziert werden.',
        persistenceFailed: 'Der globale Waste-Ausweichtermin konnte nicht gespeichert werden.',
      },
      loadExisting: () => loadGlobalDateShift(instanceId, shiftId),
      save: () => saveGlobalDateShift(instanceId, toGlobalDateShiftInput(shiftId, parsed.data)),
      loadSaved: () => loadGlobalDateShift(instanceId, shiftId),
    });
  },
  deleteWasteManagementGlobalDateShiftInternal: async (
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

    const loadGlobalDateShift = requireDeps(deps.loadWasteGlobalDateShiftById, 'loadWasteGlobalDateShiftById');

    return runWasteDeleteMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: shiftId,
      audit: {
        actionId: 'waste-management.global-date-shift.deleted',
        resourceType: 'waste_global_date_shift',
      },
      messages: {
        notFound: 'Der globale Waste-Ausweichtermin wurde nicht gefunden.',
        deleteFailed: 'Der globale Waste-Ausweichtermin konnte nicht gelöscht werden.',
      },
      loadExisting: () => loadGlobalDateShift(instanceId, shiftId),
      remove: () => requireDeps(deps.deleteWasteGlobalDateShift, 'deleteWasteGlobalDateShift')(instanceId, shiftId),
    });
  },
};
