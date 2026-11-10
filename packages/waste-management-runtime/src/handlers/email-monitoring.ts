import { z } from 'zod';
import { createApiError } from '@sva/server-runtime';
import {
  wasteEmailMonitoringPermission,
  type WasteEmailMonitoringQuery,
  type WasteEmailMonitoringOverview,
} from '@sva/waste-management-contracts';
import { authorizeWasteManagementAction } from './auth.js';
import { createJsonApiItemResponse } from './read-support.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';

export type WasteEmailMonitoringDeps = {
  loadWasteEmailMonitoring?: (
    instanceId: string,
    query: WasteEmailMonitoringQuery
  ) => Promise<WasteEmailMonitoringOverview>;
};
const filters = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['pending', 'active', 'unsubscribed', 'expired']).optional(),
  subscriptionId: z.string().uuid().optional(),
  deliveryPage: z.coerce.number().int().min(1).max(100000).default(1),
});
export const getWasteEmailMonitoringInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const denied = await authorizeWasteManagementAction(
    ctx,
    wasteEmailMonitoringPermission,
    deps,
    requestId
  );
  if (denied) return denied;
  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) return instanceId;
  const params = new URL(request.url).searchParams;
  const result = filters.safeParse({
    status: params.get('status') ?? undefined,
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
    subscriptionId: params.get('subscriptionId') ?? undefined,
    deliveryPage: params.get('deliveryPage') ?? undefined,
  });
  if (!result.success)
    return createApiError(400, 'invalid_request', 'Invalid monitoring filters', requestId);
  try {
    const data = await requireDeps(deps.loadWasteEmailMonitoring, 'loadWasteEmailMonitoring')(
      instanceId,
      result.data
    );
    const response = createJsonApiItemResponse(data, requestId);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    // Do not log database/provider errors which may contain recipient data.
    return createApiError(503, 'database_unavailable', 'Email monitoring unavailable', requestId);
  }
};
