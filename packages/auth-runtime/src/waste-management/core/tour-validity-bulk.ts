import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementTourSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const { updateWasteTourValidityBulkSchema } = wasteManagementTourSchemas;

const resolveBulkValidityInputError = (error: unknown): Readonly<{
  code: 'invalid_request' | 'not_found';
  message: string;
  reasonCode: string;
}> | null => {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('bulk_tour_validity_not_found:')) {
    return {
      code: 'not_found',
      message: 'Mindestens eine ausgewählte Waste-Tour wurde nicht gefunden.',
      reasonCode: 'tour_not_found',
    };
  }
  if (message.startsWith('bulk_tour_validity_not_applicable:')) {
    return {
      code: 'invalid_request',
      message: 'Der Gültigkeitszeitraum kann nur für turnusbasierte Touren geändert werden.',
      reasonCode: 'tour_validity_not_applicable',
    };
  }
  if (message.startsWith('bulk_tour_validity_invalid_range:')) {
    return {
      code: 'invalid_request',
      message: 'Das Gültigkeitsende darf nicht vor dem Gültigkeitsbeginn liegen.',
      reasonCode: 'invalid_validity_range',
    };
  }
  return null;
};

export const wasteManagementTourValidityBulkHandlers = {
  updateWasteManagementTourValidityBulkInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(
      ctx,
      'waste-management.tours.manage',
      deps,
      requestId
    );
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

    const parsed = await parseRequestBody(request, updateWasteTourValidityBulkSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const resourceId = `count:${parsed.data.tourIds.length}`;
    try {
      const result = await requireDeps(
        deps.updateWasteTourValidityBulk,
        'updateWasteTourValidityBulk'
      )(instanceId, {
        tourIds: parsed.data.tourIds.map((tourId) => tourId.trim()),
        firstDate: parsed.data.firstDate,
        endDate: parsed.data.endDate,
      });

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour.validity-bulk-updated',
        result: 'success',
        resourceType: 'waste_tour_batch',
        resourceId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'success');

      return new Response(JSON.stringify(asApiItem(result, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }

      const inputError = resolveBulkValidityInputError(error);
      const reasonCode = inputError?.reasonCode ?? 'database_unavailable';
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour.validity-bulk-updated',
        result: 'failure',
        reasonCode,
        resourceType: 'waste_tour_batch',
        resourceId,
      });

      if (inputError) {
        return createApiError(
          inputError.code === 'not_found' ? 404 : 400,
          inputError.code,
          inputError.message,
          requestId
        );
      }

      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(
        503,
        'database_unavailable',
        'Die Gültigkeitszeiträume der Waste-Touren konnten nicht gespeichert werden.',
        requestId
      );
    }
  },
};
