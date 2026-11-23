import { z } from 'zod';
import { createApiError, parseRequestBody } from '@sva/server-runtime';
import {
  isWasteReminderEmailAddress,
  wasteEmailMonitoringPermission,
  type WasteEmailMonitoringOverview,
} from '@sva/waste-management-contracts';
import type { WasteEmailMonitoringLookup } from '../repositories/email-reminders.monitoring.js';
import { hashWasteReminderEmail } from '../repositories/email-reminders.subscriptions.js';
import { authorizeWasteManagementAction } from './auth.js';
import { createJsonApiItemResponse } from './read-support.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';

export type WasteEmailMonitoringDeps = {
  loadWasteEmailMonitoring?: (
    instanceId: string,
    query: WasteEmailMonitoringLookup
  ) => Promise<WasteEmailMonitoringOverview>;
};
const filters = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['pending', 'active', 'unsubscribed', 'expired']).optional(),
  subscriptionId: z.string().uuid().optional(),
  deliveryPage: z.coerce.number().int().min(1).max(100000).default(1),
});

const searchFilters = filters.omit({ status: true }).extend({
  email: z.string().trim().max(254).refine(isWasteReminderEmailAddress),
}).strict();

const noStore = (response: Response): Response => {
  response.headers.set('Cache-Control', 'no-store');
  return response;
};

const readFilters = async (request: Request): Promise<WasteEmailMonitoringLookup | null> => {
  if (request.method === 'POST') {
    const result = await parseRequestBody(request, searchFilters);
    if (!result.ok) return null;
    const { email, ...pagination } = result.data;
    return { ...pagination, status: 'active', emailHash: hashWasteReminderEmail(email) };
  }
  const params = new URL(request.url).searchParams;
  const result = filters.safeParse({
    status: params.get('status') ?? undefined,
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
    subscriptionId: params.get('subscriptionId') ?? undefined,
    deliveryPage: params.get('deliveryPage') ?? undefined,
  });
  return result.success ? result.data : null;
};

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
  if (denied) return noStore(denied);
  const instanceId = requireActorInstanceId(ctx, requestId);
  if (instanceId instanceof Response) return noStore(instanceId);
  const query = await readFilters(request).catch(() => null);
  if (!query)
    return noStore(createApiError(400, 'invalid_request', 'Invalid monitoring filters', requestId));
  try {
    const data = await requireDeps(deps.loadWasteEmailMonitoring, 'loadWasteEmailMonitoring')(
      instanceId,
      query
    );
    return noStore(createJsonApiItemResponse(data, requestId));
  } catch {
    // Do not log database/provider errors which may contain recipient data.
    return noStore(createApiError(503, 'database_unavailable', 'Email monitoring unavailable', requestId));
  }
};
