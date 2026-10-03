import { createApiError, readPage } from '@sva/server-runtime';

import { authorizeWasteManagementAction } from './auth.js';
import { getWasteManagementMainserverSyncStatusInternal } from './mainserver-sync-status-read-handler.js';
import { wasteManagementOverviewReadHandlers } from './read-overview-handlers.js';
import {
  createJsonApiItemResponse,
  logWasteReadFailure,
  toOptionalTrimmedSearchParam,
} from './read-support.js';
import { loadConfiguredWasteSettings } from './settings-shared.js';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

export const wasteManagementReadHandlers = {
  getWasteManagementMainserverSyncStatusInternal,
  getWasteManagementSettingsInternal: async (
    _request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(
      ctx,
      'waste-management.settings.manage',
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
      const settings = await loadConfiguredWasteSettings(deps, instanceId);
      return createJsonApiItemResponse(settings, requestId);
    } catch (error) {
      logWasteReadFailure(
        'get_waste_management_settings',
        'Waste settings overview failed',
        instanceId,
        error
      );
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Einstellungen konnten nicht geladen werden.',
        requestId
      );
    }
  },
  getWasteManagementHistoryInternal: async (
    request: Request,
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

    const { page, pageSize } = readPage(request);
    const search = toOptionalTrimmedSearchParam(request, 'q');

    try {
      const overview = await requireDeps(
        deps.loadWasteHistoryOverview,
        'loadWasteHistoryOverview'
      )({
        instanceId,
        search,
        page,
        pageSize,
      });
      return createJsonApiItemResponse(overview, requestId);
    } catch (error) {
      logWasteReadFailure(
        'get_waste_management_history_overview',
        'Waste history overview failed',
        instanceId,
        error
      );
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Historie konnte nicht geladen werden.',
        requestId
      );
    }
  },
  ...wasteManagementOverviewReadHandlers,
};
