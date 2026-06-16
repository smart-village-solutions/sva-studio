import { createSdkLogger } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { buildLogContext } from '../../log-context.js';
import { createApiError } from '../../shared/request-helpers.js';
import { emitWasteAuditEvent } from './auth.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';

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

const isForeignKeyConflict = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23503';

export const logWasteTourDeleteRequested = (request: Request, instanceId: string, tourId: string) => {
  logger.info('waste_tour_delete_requested', {
    operation: 'delete_waste_tour',
    tour_id: tourId,
    request_method: request.method,
    request_url: request.url,
    ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
  });
};

export const logWasteTourDeleteLoaded = (
  instanceId: string,
  tourId: string,
  existing: {
    readonly name: string;
    readonly recurrence?: string | null;
    readonly locationCount?: number;
    readonly wasteFractionIds: readonly string[];
  }
) => {
  logger.info('waste_tour_delete_existing_loaded', {
    operation: 'delete_waste_tour',
    tour_id: tourId,
    tour_name: existing.name,
    recurrence: existing.recurrence,
    location_count: existing.locationCount,
    waste_fraction_ids: existing.wasteFractionIds,
    ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
  });
};

export const logWasteTourDeleteFinalDelete = (instanceId: string, tourId: string, phase: 'started' | 'completed') => {
  logger.info(`waste_tour_delete_final_delete_${phase}`, {
    operation: 'delete_waste_tour',
    tour_id: tourId,
    ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
  });
};

export const createWasteTourDeleteErrorResponse = async ({
  deps,
  ctx,
  instanceId,
  requestId,
  tourId,
  error,
}: {
  readonly deps: WasteManagementHandlerDeps;
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly requestId: string | undefined;
  readonly tourId: string;
  readonly error: unknown;
}) => {
  const isConflict = isForeignKeyConflict(error);
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
};
