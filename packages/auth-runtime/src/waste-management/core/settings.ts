import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { createApiError, parseRequestBody } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementSettingsSchemas } from './schemas.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import {
  runWasteManagementHolidaySyncAfterValidation,
  updateWasteManagementSettingsAfterValidation,
} from './settings-write-support.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId } from './utils.js';

const { updateWasteSettingsSchema } = wasteManagementSettingsSchemas;

export const wasteManagementSettingsHandlers = {
  updateWasteManagementSettingsInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.settings.manage', deps, requestId);
    if (authError) return authError;

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) return instanceId;

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) return csrfError;

    const parsed = await parseRequestBody(request, updateWasteSettingsSchema);
    if (!parsed.ok) return createApiError(400, 'invalid_request', parsed.message, requestId);

    try {
      return await updateWasteManagementSettingsAfterValidation({ deps, ctx, instanceId, requestId, input: parsed.data });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.settings.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_data_source',
        resourceId: instanceId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht gespeichert werden.', requestId);
    }
  },
  runWasteManagementHolidaySyncInternal: async (
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

    try {
      return await runWasteManagementHolidaySyncAfterValidation({ deps, ctx, instanceId, requestId });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      return createApiError(
        503,
        'database_unavailable',
        'Der Waste-Feiertagssync konnte nicht ausgeführt werden.',
        requestId
      );
    }
  },
};
