import { createApiError } from '../../shared/request-helpers.js';
import type { AuthenticatedRequestContext } from '../../middleware.js';
import { authorizeWasteManagementAction } from './auth.js';
import { createJsonApiItemResponse, logWasteReadFailure } from './read-support.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

export const getWasteManagementMainserverSyncStatusInternal = async (
  _request: Request,
  ctx: AuthenticatedRequestContext,
  deps: WasteManagementHandlerDeps = {}
): Promise<Response> => {
  const requestId = getRequestId(deps);
  const authError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.read',
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

  try {
    const status = await requireDeps(
      deps.loadWasteMainserverSyncStatus,
      'loadWasteMainserverSyncStatus'
    )(instanceId);
    return createJsonApiItemResponse(status, requestId);
  } catch (error) {
    logWasteReadFailure(
      'get_waste_mainserver_sync_status',
      'Waste mainserver sync status failed',
      instanceId,
      error
    );
    return createApiError(
      503,
      'database_unavailable',
      'Der Mainserver-Abgleichsstatus konnte nicht geladen werden.',
      requestId
    );
  }
};
