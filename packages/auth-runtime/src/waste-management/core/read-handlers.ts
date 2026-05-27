import { asApiItem, createApiError, parseRequestBody, readPage } from '../../shared/request-helpers.js';
import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { z } from 'zod';
import { authorizeWasteManagementAction } from './auth.js';
import { loadConfiguredWasteSettings, updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const wasteOutputPdfRequestSchema = z.object({
  collectionLocationId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
});

const isWasteOutputLocationNotFoundError = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith('waste_output_location_not_found:');

const toOptionalTrimmedSearchParam = (request: Request, key: string): string | undefined => {
  const value = new URL(request.url).searchParams.get(key)?.trim();
  return value ? value : undefined;
};

const resolveMasterDataOverview = async (
  request: Request,
  deps: WasteManagementHandlerDeps,
  instanceId: string
) => {
  const scope = toOptionalTrimmedSearchParam(request, 'scope');
  if (scope === 'fractions') {
    return requireDeps(deps.loadMasterDataFractionsOverview, 'loadMasterDataFractionsOverview')(instanceId);
  }

  if (scope === 'locations') {
    return requireDeps(deps.loadMasterDataLocationsOverview, 'loadMasterDataLocationsOverview')(instanceId);
  }

  return requireDeps(deps.loadMasterDataOverview, 'loadMasterDataOverview')(instanceId);
};

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
    } catch {
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
    } catch {
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

    try {
      const overview = await resolveMasterDataOverview(request, deps, instanceId);
      await updateWasteVisibleStatus(deps, instanceId, 'success');
      return new Response(JSON.stringify(asApiItem(overview, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
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
      await updateWasteVisibleStatus(deps, instanceId, 'success');
      return new Response(JSON.stringify(asApiItem(overview, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
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
      await updateWasteVisibleStatus(deps, instanceId, 'success');
      return new Response(JSON.stringify(asApiItem(overview, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Ausweichtermine konnten nicht geladen werden.',
        requestId
      );
    }
  },
  getWasteManagementOutputOverviewInternal: async (
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
      const overview = await requireDeps(deps.loadWasteOutputOverview, 'loadWasteOutputOverview')(instanceId);
      await updateWasteVisibleStatus(deps, instanceId, 'success');
      return new Response(JSON.stringify(asApiItem(overview, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(503, 'database_unavailable', 'Die Waste-Ausgaben konnten nicht geladen werden.', requestId);
    }
  },
  createWasteManagementOutputPdfInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.master-data.manage', deps, requestId);
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

    const parsed = await parseRequestBody(request, wasteOutputPdfRequestSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const result = await requireDeps(deps.generateWasteOutputPdf, 'generateWasteOutputPdf')({
        instanceId,
        collectionLocationId: parsed.data.collectionLocationId,
        year: parsed.data.year,
      });
      return new Response(JSON.stringify(asApiItem(result, requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (isWasteOutputLocationNotFoundError(error)) {
        return createApiError(404, 'not_found', 'Der Waste-Abholort wurde nicht gefunden.', requestId);
      }
      return createApiError(
        503,
        'internal_error',
        'Das Waste-PDF konnte derzeit nicht erzeugt werden.',
        requestId
      );
    }
  },
};
