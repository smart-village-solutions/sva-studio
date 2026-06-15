import { createSdkLogger } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { buildLogContext } from '../../log-context.js';
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
const logger = createSdkLogger({ component: 'waste-management-auth-runtime', level: 'info' });

const toErrorLogFields = (error: unknown) =>
  typeof error === 'object' && error !== null
    ? {
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
        error_name: 'name' in error && typeof error.name === 'string' ? error.name : undefined,
        error_code: 'code' in error && typeof error.code === 'string' ? error.code : undefined,
        error_constraint:
          'constraint' in error && typeof error.constraint === 'string' ? error.constraint : undefined,
        error_detail: 'detail' in error && typeof error.detail === 'string' ? error.detail : undefined,
        error_table: 'table' in error && typeof error.table === 'string' ? error.table : undefined,
      }
    : {
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
        error_name: undefined,
        error_code: undefined,
        error_constraint: undefined,
        error_detail: undefined,
        error_table: undefined,
      };

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
      logger.info('waste_tour_delete_requested', {
        operation: 'delete_waste_tour',
        tour_id: tourId,
        request_method: request.method,
        request_url: request.url,
        ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
      });

      const existing = await requireDeps(deps.loadWasteTourById, 'loadWasteTourById')(instanceId, tourId);
      if (!existing) {
        return createApiError(404, 'not_found', 'Die Waste-Tour wurde nicht gefunden.', requestId);
      }

      logger.info('waste_tour_delete_existing_loaded', {
        operation: 'delete_waste_tour',
        tour_id: tourId,
        tour_name: existing.name,
        recurrence: existing.recurrence,
        location_count: existing.locationCount,
        waste_fraction_ids: existing.wasteFractionIds,
        ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
      });

      await deleteWasteTourDependencies({ deps, instanceId, tourId });
      logger.info('waste_tour_delete_final_delete_started', {
        operation: 'delete_waste_tour',
        tour_id: tourId,
        ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
      });
      await requireDeps(deps.deleteWasteTour, 'deleteWasteTour')(instanceId, tourId);
      logger.info('waste_tour_delete_final_delete_completed', {
        operation: 'delete_waste_tour',
        tour_id: tourId,
        ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
      });

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
      logger.error('waste_tour_delete_failed', {
        operation: 'delete_waste_tour',
        tour_id: tourId,
        is_conflict: isConflict,
        ...toErrorLogFields(error),
        ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
      });
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
