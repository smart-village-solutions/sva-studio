import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementTourSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const { updateWasteTourStatusBulkSchema } = wasteManagementTourSchemas;

export const wasteManagementTourStatusBulkHandlers = {
  updateWasteManagementTourStatusBulkInternal: async (
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

    const parsed = await parseRequestBody(request, updateWasteTourStatusBulkSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const resourceId = `count:${parsed.data.tourIds.length};status:${parsed.data.status}`;
    try {
      const result = await requireDeps(deps.updateWasteTourStatusBulk, 'updateWasteTourStatusBulk')(
        instanceId,
        {
          tourIds: parsed.data.tourIds.map((tourId) => tourId.trim()),
          status: parsed.data.status,
        }
      );

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour.status-bulk-updated',
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

      const notFound =
        error instanceof Error && error.message.startsWith('bulk_tour_status_not_found:');
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.tour.status-bulk-updated',
        result: 'failure',
        reasonCode: notFound ? 'tour_not_found' : 'database_unavailable',
        resourceType: 'waste_tour_batch',
        resourceId,
      });

      if (notFound) {
        return createApiError(
          404,
          'not_found',
          'Mindestens eine ausgewählte Waste-Tour wurde nicht gefunden.',
          requestId
        );
      }

      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(
        503,
        'database_unavailable',
        'Der Status der Waste-Touren konnte nicht gespeichert werden.',
        requestId
      );
    }
  },
};
