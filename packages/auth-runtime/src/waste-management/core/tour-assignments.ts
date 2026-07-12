import type { WasteTourAssignmentRecord } from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction } from './auth.js';
import {
  runWasteCreateMutation,
  runWasteDeleteMutation,
  runWasteUpdateMutation,
} from './mutation-helpers.js';
import { wasteManagementTourSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import {
  getRequestId,
  normalizeOptionalString,
  requireActorInstanceId,
  requireDeps,
} from './utils.js';

type TourAssignmentInput = Omit<WasteTourAssignmentRecord, 'createdAt' | 'updatedAt'>;

const toTourAssignmentInput = (
  id: string,
  data: {
    tourId: string;
    pickupDate: string;
    note?: string;
    locationIds: readonly string[];
  }
): TourAssignmentInput => ({
  id,
  tourId: data.tourId,
  pickupDate: data.pickupDate,
  note: normalizeOptionalString(data.note) ?? null,
  locationIds: [...new Set(data.locationIds)],
});

const authorizeTourAssignmentMutation = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps
): Promise<
  | { readonly ok: true; readonly instanceId: string; readonly requestId?: string }
  | { readonly ok: false; readonly response: Response }
> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.scheduling.manage',
    deps,
    requestId
  );
  if (authError) {
    return { ok: false, response: authError };
  }

  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) {
    return { ok: false, response: instanceId };
  }

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return { ok: false, response: csrfError };
  }

  return { ok: true, instanceId, requestId };
};

const readAssignmentId = (request: Request, requestId?: string): string | Response => {
  const assignmentId = readPathSegment(request, 4)?.trim();
  if (!assignmentId) {
    return createApiError(400, 'invalid_request', 'assignmentId fehlt im Pfad.', requestId);
  }
  return assignmentId;
};

export const wasteManagementTourAssignmentHandlers = {
  createWasteManagementTourAssignmentInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const access = await authorizeTourAssignmentMutation(request, ctx, deps);
    if (!access.ok) {
      return access.response;
    }

    const parsed = await parseRequestBody(
      request,
      wasteManagementTourSchemas.createWasteTourAssignmentSchema
    );
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, access.requestId);
    }

    return runWasteCreateMutation({
      deps,
      ctx,
      instanceId: access.instanceId,
      requestId: access.requestId,
      resourceId: parsed.data.id,
      audit: {
        actionId: 'waste-management.tour-assignment.created',
        resourceType: 'waste_tour_assignment',
      },
      messages: {
        verificationFailed: 'Der Waste-Einsatz konnte nicht verifiziert werden.',
        persistenceFailed: 'Der Waste-Einsatz konnte nicht gespeichert werden.',
      },
      save: () =>
        requireDeps(deps.saveWasteTourAssignment, 'saveWasteTourAssignment')(
          access.instanceId,
          toTourAssignmentInput(parsed.data.id, parsed.data)
        ),
      loadSaved: () =>
        requireDeps(deps.loadWasteTourAssignmentById, 'loadWasteTourAssignmentById')(
          access.instanceId,
          parsed.data.id
        ),
    });
  },

  updateWasteManagementTourAssignmentInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const access = await authorizeTourAssignmentMutation(request, ctx, deps);
    if (!access.ok) {
      return access.response;
    }

    const assignmentId = readAssignmentId(request, access.requestId);
    if (assignmentId instanceof Response) {
      return assignmentId;
    }

    const parsed = await parseRequestBody(
      request,
      wasteManagementTourSchemas.updateWasteTourAssignmentSchema
    );
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, access.requestId);
    }

    return runWasteUpdateMutation({
      deps,
      ctx,
      instanceId: access.instanceId,
      requestId: access.requestId,
      resourceId: assignmentId,
      audit: {
        actionId: 'waste-management.tour-assignment.updated',
        resourceType: 'waste_tour_assignment',
      },
      messages: {
        notFound: 'Der Waste-Einsatz wurde nicht gefunden.',
        verificationFailed: 'Der Waste-Einsatz konnte nicht verifiziert werden.',
        persistenceFailed: 'Der Waste-Einsatz konnte nicht gespeichert werden.',
      },
      loadExisting: () =>
        requireDeps(deps.loadWasteTourAssignmentById, 'loadWasteTourAssignmentById')(
          access.instanceId,
          assignmentId
        ),
      save: () =>
        requireDeps(deps.saveWasteTourAssignment, 'saveWasteTourAssignment')(
          access.instanceId,
          toTourAssignmentInput(assignmentId, parsed.data)
        ),
      loadSaved: () =>
        requireDeps(deps.loadWasteTourAssignmentById, 'loadWasteTourAssignmentById')(
          access.instanceId,
          assignmentId
        ),
    });
  },

  deleteWasteManagementTourAssignmentInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const access = await authorizeTourAssignmentMutation(request, ctx, deps);
    if (!access.ok) {
      return access.response;
    }

    const assignmentId = readAssignmentId(request, access.requestId);
    if (assignmentId instanceof Response) {
      return assignmentId;
    }

    return runWasteDeleteMutation({
      deps,
      ctx,
      instanceId: access.instanceId,
      requestId: access.requestId,
      resourceId: assignmentId,
      audit: {
        actionId: 'waste-management.tour-assignment.deleted',
        resourceType: 'waste_tour_assignment',
      },
      messages: {
        notFound: 'Der Waste-Einsatz wurde nicht gefunden.',
        deleteFailed: 'Der Waste-Einsatz konnte nicht gelöscht werden.',
      },
      loadExisting: () =>
        requireDeps(deps.loadWasteTourAssignmentById, 'loadWasteTourAssignmentById')(
          access.instanceId,
          assignmentId
        ),
      remove: () =>
        requireDeps(deps.deleteWasteTourAssignment, 'deleteWasteTourAssignment')(
          access.instanceId,
          assignmentId
        ),
    });
  },
};
