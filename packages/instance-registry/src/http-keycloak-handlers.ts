import type { InstanceRegistryService } from './service-types.js';
import { readDetailInstanceId, readKeycloakRunId } from './http-contracts.js';

type CreateApiError = (
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
) => Response;

type JsonResponse = (status: number, payload: unknown) => Response;

type AsApiItem = <T>(value: T, requestId?: string) => unknown;

export type InstanceRegistryKeycloakHttpDeps<TContext> = {
  readonly getRequestId: () => string | undefined;
  readonly createApiError: CreateApiError;
  readonly jsonResponse: JsonResponse;
  readonly asApiItem: AsApiItem;
  readonly mapMutationError: (error: unknown) => Response;
  readonly ensurePlatformAccess: (request: Request, ctx: TContext) => Response | null;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
  readonly requireFreshReauth: (request: Request) => Response | null;
  readonly withRegistryService: <T>(work: (service: InstanceRegistryService) => Promise<T>) => Promise<T>;
};

const readInstanceIdOrError = <TContext>(
  deps: InstanceRegistryKeycloakHttpDeps<TContext>,
  request: Request
): string | Response => {
  const instanceId = readDetailInstanceId(request);
  return instanceId ?? deps.createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', deps.getRequestId());
};

const guardKeycloakReadRequest = <TContext>(
  deps: InstanceRegistryKeycloakHttpDeps<TContext>,
  request: Request,
  ctx: TContext,
  requireMutationGuards = false
): string | Response => {
  const accessError = deps.ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }
  if (requireMutationGuards) {
    const csrfError = deps.validateCsrf(request, deps.getRequestId());
    if (csrfError) {
      return csrfError;
    }
    const reauthError = deps.requireFreshReauth(request);
    if (reauthError) {
      return reauthError;
    }
  }
  return readInstanceIdOrError(deps, request);
};

const respondWithInstanceLookup = async <TContext, TValue>(
  deps: InstanceRegistryKeycloakHttpDeps<TContext>,
  request: Request,
  ctx: TContext,
  work: (instanceId: string) => Promise<TValue | null>,
  notFoundMessage: string,
  requireMutationGuards = false
): Promise<Response> => {
  const guarded = guardKeycloakReadRequest(deps, request, ctx, requireMutationGuards);
  if (guarded instanceof Response) {
    return guarded;
  }

  try {
    const value = await work(guarded);
    if (!value) {
      return deps.createApiError(404, 'not_found', notFoundMessage, deps.getRequestId());
    }
    return deps.jsonResponse(200, deps.asApiItem(value, deps.getRequestId()));
  } catch (error) {
    return deps.mapMutationError(error);
  }
};

export const createInstanceRegistryKeycloakHttpHandlers = <TContext>(
  deps: InstanceRegistryKeycloakHttpDeps<TContext>
) => ({
  getInstanceKeycloakStatus: (request: Request, ctx: TContext): Promise<Response> =>
    respondWithInstanceLookup(
      deps,
      request,
      ctx,
      async (instanceId) => deps.withRegistryService((service) => service.getKeycloakStatus(instanceId)),
      'Instanz wurde nicht gefunden.'
    ),

  getInstanceKeycloakPreflight: (request: Request, ctx: TContext): Promise<Response> =>
    respondWithInstanceLookup(
      deps,
      request,
      ctx,
      async (instanceId) => deps.withRegistryService((service) => service.getKeycloakPreflight(instanceId)),
      'Instanz wurde nicht gefunden.'
    ),

  planInstanceKeycloakProvisioning: (request: Request, ctx: TContext): Promise<Response> =>
    respondWithInstanceLookup(
      deps,
      request,
      ctx,
      async (instanceId) => deps.withRegistryService((service) => service.planKeycloakProvisioning(instanceId)),
      'Instanz wurde nicht gefunden.',
      true
    ),

  getInstanceKeycloakProvisioningRun: async (request: Request, ctx: TContext): Promise<Response> => {
    const guarded = guardKeycloakReadRequest(deps, request, ctx);
    if (guarded instanceof Response) {
      return guarded;
    }

    const runId = readKeycloakRunId(request);
    if (!runId) {
      return deps.createApiError(400, 'invalid_request', 'Provisioning-Run-ID fehlt.', deps.getRequestId());
    }

    try {
      const run = await deps.withRegistryService((service) => service.getKeycloakProvisioningRun(guarded, runId));
      if (!run) {
        return deps.createApiError(404, 'not_found', 'Provisioning-Run wurde nicht gefunden.', deps.getRequestId());
      }
      return deps.jsonResponse(200, deps.asApiItem(run, deps.getRequestId()));
    } catch (error) {
      return deps.mapMutationError(error);
    }
  },
});
