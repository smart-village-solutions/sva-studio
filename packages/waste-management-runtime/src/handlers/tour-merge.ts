import type { WasteTourMergeInput, WasteTourMergeResult } from '@sva/waste-management-contracts';
import { wasteTourStatusBulkLimit } from '@sva/waste-management-contracts';
import { asApiItem, createApiError, createSdkLogger, parseRequestBody } from '@sva/server-runtime';
import { z } from 'zod';

import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { validateCsrf } from './host-controls.js';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId } from './utils.js';

const logger = createSdkLogger({ component: 'waste-management-tour-merge' });
const tourId = z
  .string()
  .trim()
  .uuid()
  .transform((value) => value.toLowerCase());
const inputSchema = z
  .object({
    tourIds: z.array(tourId).min(2).max(wasteTourStatusBulkLimit),
    targetTourId: tourId,
    confirmationToken: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .strict()
  .refine(
    (input) =>
      new Set(input.tourIds).size === input.tourIds.length &&
      input.tourIds.includes(input.targetTourId),
    {
      message:
        'Wählen Sie mindestens zwei unterschiedliche Touren und eine Zieltour aus dieser Auswahl.',
    }
  );

export const handleWasteTourMerge = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps,
  merge: (instanceId: string, input: WasteTourMergeInput) => Promise<WasteTourMergeResult | null>
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const denied = await authorizeWasteManagementAction(
    ctx,
    'waste-management.tours.manage',
    deps,
    requestId
  );
  if (denied) return denied;
  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) return instanceId;
  const csrfError = validateCsrf(deps, request, requestId);
  if (csrfError) return csrfError;

  const parsed = await parseRequestBody(request, inputSchema);
  if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, requestId);
  const input = parsed.data;
  const result = await merge(instanceId, input);
  if (!result)
    return createApiError(
      404,
      'not_found',
      'Mindestens eine ausgewählte Tour wurde nicht gefunden.',
      requestId
    );

  if (input.confirmationToken) {
    const outcome = result.kind === 'merged' ? 'success' : 'failure';
    logger.info('waste_tour_merge_finished', {
      instance_id: instanceId,
      request_id: requestId,
      target_tour_id: input.targetTourId,
      selected_tour_ids: JSON.stringify(input.tourIds),
      result: result.kind,
      ...(result.kind === 'merged'
        ? { collection_point_count: result.totalCount, archived_tour_count: result.archivedCount }
        : {}),
    });
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.tour.merged',
      result: outcome,
      reasonCode: outcome === 'failure' ? result.kind : undefined,
      resourceType: 'waste_tour_batch',
      resourceId: `${input.targetTourId};selected:${input.tourIds.length}`,
      requestId,
    });
  }
  return Response.json(asApiItem(result, requestId));
};
