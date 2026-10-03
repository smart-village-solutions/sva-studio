import { asApiItem, createApiError } from '@sva/server-runtime';
import { emitWasteAuditEvent } from './auth.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';

type DeleteMutationArgs = Readonly<{
  deps: WasteManagementHandlerDeps;
  ctx: AuthenticatedRequestContext;
  instanceId: string;
  requestId?: string;
  resourceId: string;
  audit: Readonly<{ actionId: string; resourceType: string }>;
  messages: Readonly<{ notFound: string; deleteFailed: string }>;
  loadExisting: () => Promise<unknown | null>;
  remove: () => Promise<void>;
}>;

export const runWasteDeleteMutation = async ({
  deps,
  ctx,
  instanceId,
  requestId,
  resourceId,
  audit,
  messages,
  loadExisting,
  remove,
}: DeleteMutationArgs): Promise<Response> => {
  try {
    const existing = await loadExisting();
    if (!existing) {
      return createApiError(404, 'not_found', messages.notFound, requestId);
    }

    await remove();

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: audit.actionId,
      result: 'success',
      resourceType: audit.resourceType,
      resourceId,
    });

    await updateWasteVisibleStatus(deps, instanceId, 'success');
    return new Response(JSON.stringify(asApiItem({ id: resourceId }, requestId)), {
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
      actionId: audit.actionId,
      result: 'failure',
      reasonCode: 'database_unavailable',
      resourceType: audit.resourceType,
      resourceId,
    });
    await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
    return createApiError(503, 'database_unavailable', messages.deleteFailed, requestId);
  }
};
