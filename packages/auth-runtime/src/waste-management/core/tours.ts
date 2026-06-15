import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementTourSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import {
  createWasteManagementTourAfterValidation,
  createWasteTourWriteInput,
  deleteWasteTourDependencies,
} from './tours-write-support.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const { createWasteTourSchema, updateWasteTourSchema } = wasteManagementTourSchemas;

export const wasteManagementTourHandlers = {
  createWasteManagementTourInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
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

    const parsed = await parseRequestBody(request, createWasteTourSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    if (parsed.data.duplicateFromTourId) {
      const schedulingAuthError = await authorizeWasteManagementAction(
        ctx,
        'waste-management.scheduling.manage',
        deps,
        requestId
      );
      if (schedulingAuthError) {
        return schedulingAuthError;
      }
    }

    try {
      return await createWasteManagementTourAfterValidation({
        deps,
        ctx,
        instanceId,
        requestId,
        input: {
          ...parsed.data,
          locationCount: undefined,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour.created',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_tour',
        resourceId: parsed.data.id,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Tour konnte nicht gespeichert werden.', requestId);
    }
  },
  updateWasteManagementTourInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const tourId = readPathSegment(request, 4)?.trim();
    if (!tourId) {
      return createApiError(400, 'invalid_request', 'tourId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteTourSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const existing = await requireDeps(deps.loadWasteTourById, 'loadWasteTourById')(instanceId, tourId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Die Waste-Tour wurde nicht gefunden.', requestId);
      }

      await requireDeps(deps.saveWasteTour, 'saveWasteTour')(instanceId, {
        ...createWasteTourWriteInput({
          ...parsed.data,
          id: tourId,
          locationCount: existing.locationCount,
        }),
      });

      const saved = await requireDeps(deps.loadWasteTourById, 'loadWasteTourById')(instanceId, tourId);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.tour.updated',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_tour',
          resourceId: tourId,
        });
        return createApiError(503, 'database_unavailable', 'Die Waste-Tour konnte nicht verifiziert werden.', requestId);
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour.updated',
        result: 'success',
        resourceType: 'waste_tour',
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
        actionId: 'waste-management.tour.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_tour',
        resourceId: tourId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Tour konnte nicht gespeichert werden.', requestId);
    }
  },
  deleteWasteManagementTourInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.tours.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const tourId = readPathSegment(request, 4)?.trim();
    if (!tourId) {
      return createApiError(400, 'invalid_request', 'tourId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    try {
      const existing = await requireDeps(deps.loadWasteTourById, 'loadWasteTourById')(instanceId, tourId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Die Waste-Tour wurde nicht gefunden.', requestId);
      }

      await deleteWasteTourDependencies({ deps, instanceId, tourId });
      await requireDeps(deps.deleteWasteTour, 'deleteWasteTour')(instanceId, tourId);

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour.deleted',
        result: 'success',
        resourceType: 'waste_tour',
        resourceId: tourId,
      });

      await updateWasteVisibleStatus(deps, instanceId, 'success');
      return new Response(JSON.stringify(asApiItem({ id: tourId }, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      const isConflict = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23503';
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour.deleted',
        result: 'failure',
        reasonCode: isConflict ? 'conflict' : 'database_unavailable',
        resourceType: 'waste_tour',
        resourceId: tourId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return isConflict
        ? createApiError(409, 'invalid_request', 'Die Waste-Tour kann wegen bestehender Zuordnungen nicht gelöscht werden.', requestId)
        : createApiError(503, 'database_unavailable', 'Die Waste-Tour konnte nicht gelöscht werden.', requestId);
    }
  },
};
