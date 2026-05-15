import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId } from './utils.js';

export const wasteManagementSettingsHandlers = {
  updateWasteManagementSettingsInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.settings.manage', deps, requestId);
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

    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.settings.updated',
      result: 'failure',
      reasonCode: 'managed_via_interfaces',
      resourceType: 'waste_data_source',
      resourceId: instanceId,
    });
    return createApiError(
      409,
      'invalid_request',
      'Die Waste-Supabase wird ausschließlich über /interfaces verwaltet.',
      requestId
    );
  },
};
