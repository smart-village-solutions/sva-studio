import { createSdkLogger } from '@sva/server-runtime';

import { buildLogContext } from '../../log-context.js';
import { asApiItem, createApiError, readPage } from '../../shared/request-helpers.js';
import type { AuthenticatedRequestContext } from '../../middleware.js';
import { authorizeWasteManagementAction } from './auth.js';
import { loadConfiguredWasteSettings, updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const logger = createSdkLogger({ component: 'waste-management-auth-runtime', level: 'info' });

const toOptionalTrimmedSearchParam = (request: Request, key: string): string | undefined => {
  const value = new URL(request.url).searchParams.get(key)?.trim();
  return value ? value : undefined;
};

const resolveMasterDataScope = (request: Request): 'fractions' | 'locations' | 'all' => {
  const scope = toOptionalTrimmedSearchParam(request, 'scope');
  if (scope === 'fractions' || scope === 'locations') {
    return scope;
  }

  return 'all';
};

const resolveMasterDataOverview = async (
  request: Request,
  deps: WasteManagementHandlerDeps,
  instanceId: string
) => {
  const scope = resolveMasterDataScope(request);
  if (scope === 'fractions') {
    return requireDeps(deps.loadMasterDataFractionsOverview, 'loadMasterDataFractionsOverview')(instanceId);
  }

  if (scope === 'locations') {
    return requireDeps(deps.loadMasterDataLocationsOverview, 'loadMasterDataLocationsOverview')(instanceId);
  }

  return requireDeps(deps.loadMasterDataOverview, 'loadMasterDataOverview')(instanceId);
};

const logWasteReadFailure = (
  operation: string,
  message: string,
  instanceId: string,
  error: unknown,
  details?: Readonly<Record<string, string | number | boolean | undefined>>
): void => {
  logger.error(message, {
    operation,
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error_message: error instanceof Error ? error.message : String(error),
    ...details,
    ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
  });
};

const updateWasteVisibleStatusSafely = async (
  deps: WasteManagementHandlerDeps,
  instanceId: string,
  outcome: 'success' | 'revalidate',
  operation: string
): Promise<void> => {
  try {
    await updateWasteVisibleStatus(deps, instanceId, outcome);
  } catch (error) {
    logger.warn('Waste visible status update failed', {
      operation,
      update_outcome: outcome,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_message: error instanceof Error ? error.message : String(error),
      ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
    });
  }
};

const buildMasterDataLogFields = (
  scope: 'fractions' | 'locations' | 'all',
  overview: {
    readonly fractions: readonly unknown[];
    readonly regions: readonly unknown[];
    readonly cities: readonly unknown[];
    readonly streets: readonly unknown[];
    readonly houseNumbers: readonly unknown[];
    readonly collectionLocations: readonly unknown[];
    readonly locationTourLinks: readonly unknown[];
  }
) => ({
  master_data_scope: scope,
  fractions_count: overview.fractions.length,
  regions_count: overview.regions.length,
  cities_count: overview.cities.length,
  streets_count: overview.streets.length,
  house_numbers_count: overview.houseNumbers.length,
  collection_locations_count: overview.collectionLocations.length,
  location_tour_links_count: overview.locationTourLinks.length,
});

export const wasteManagementReadHandlers = {
  getWasteManagementSettingsInternal: async (
    _request: Request,
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

    try {
      const settings = await loadConfiguredWasteSettings(deps, instanceId);
      return new Response(JSON.stringify(asApiItem(settings, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logWasteReadFailure(
        'get_waste_management_settings',
        'Waste settings overview failed',
        instanceId,
        error
      );
      return createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht geladen werden.', requestId);
    }
  },
  getWasteManagementHistoryInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.read', deps, requestId);
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
      const overview = await requireDeps(deps.loadWasteHistoryOverview, 'loadWasteHistoryOverview')({
        instanceId,
        search,
        page,
        pageSize,
      });
      return new Response(JSON.stringify(asApiItem(overview, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logWasteReadFailure(
        'get_waste_management_history_overview',
        'Waste history overview failed',
        instanceId,
        error
      );
      return createApiError(503, 'database_unavailable', 'Die Waste-Historie konnte nicht geladen werden.', requestId);
    }
  },
  getWasteManagementMasterDataOverviewInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.read', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const scope = resolveMasterDataScope(request);

    try {
      const overview = await resolveMasterDataOverview(request, deps, instanceId);
      const logFields = buildMasterDataLogFields(scope, overview);
      logger.info('Waste master-data overview loaded', {
        operation: 'get_waste_management_master_data_overview',
        ...logFields,
        ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
      });
      await updateWasteVisibleStatusSafely(
        deps,
        instanceId,
        'success',
        'get_waste_management_master_data_overview'
      );
      try {
        return new Response(JSON.stringify(asApiItem(overview, requestId)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logWasteReadFailure(
          'get_waste_management_master_data_overview',
          'Waste master-data response serialization failed',
          instanceId,
          error,
          logFields
        );
        return createApiError(
          503,
          'database_unavailable',
          'Die Waste-Stammdaten konnten nicht geladen werden.',
          requestId
        );
      }
    } catch (error) {
      logWasteReadFailure(
        'get_waste_management_master_data_overview',
        'Waste master-data overview failed',
        instanceId,
        error,
        { master_data_scope: scope }
      );
      await updateWasteVisibleStatusSafely(
        deps,
        instanceId,
        'revalidate',
        'get_waste_management_master_data_overview'
      );
      return createApiError(503, 'database_unavailable', 'Die Waste-Stammdaten konnten nicht geladen werden.', requestId);
    }
  },
  getWasteManagementToursOverviewInternal: async (
    _request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.read', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    try {
      const overview = await requireDeps(deps.loadToursOverview, 'loadToursOverview')(instanceId);
      await updateWasteVisibleStatusSafely(deps, instanceId, 'success', 'get_waste_management_tours_overview');
      return new Response(JSON.stringify(asApiItem(overview, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logWasteReadFailure(
        'get_waste_management_tours_overview',
        'Waste tours overview failed',
        instanceId,
        error
      );
      await updateWasteVisibleStatusSafely(
        deps,
        instanceId,
        'revalidate',
        'get_waste_management_tours_overview'
      );
      return createApiError(503, 'database_unavailable', 'Die Waste-Touren konnten nicht geladen werden.', requestId);
    }
  },
  getWasteManagementSchedulingOverviewInternal: async (
    _request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.read', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    try {
      const overview = await requireDeps(deps.loadSchedulingOverview, 'loadSchedulingOverview')(instanceId);
      await updateWasteVisibleStatusSafely(
        deps,
        instanceId,
        'success',
        'get_waste_management_scheduling_overview'
      );
      return new Response(JSON.stringify(asApiItem(overview, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logWasteReadFailure(
        'get_waste_management_scheduling_overview',
        'Waste scheduling overview failed',
        instanceId,
        error
      );
      await updateWasteVisibleStatusSafely(
        deps,
        instanceId,
        'revalidate',
        'get_waste_management_scheduling_overview'
      );
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Ausweichtermine konnten nicht geladen werden.',
        requestId
      );
    }
  },
};
