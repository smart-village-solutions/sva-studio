import type { InstanceRegistryService } from './service-types.js';
import { readDetailInstanceId } from './http-contracts.js';

type CreateApiError = (
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
) => Response;

type JsonResponse = (status: number, payload: unknown) => Response;

type AsApiItem = <T>(value: T, requestId?: string) => unknown;

export type InstanceRegistryAuditHttpDeps<TContext> = {
  readonly getRequestId: () => string | undefined;
  readonly createApiError: CreateApiError;
  readonly jsonResponse: JsonResponse;
  readonly asApiItem: AsApiItem;
  readonly mapReadError: (error: unknown) => Response;
  readonly ensurePlatformAccess: (request: Request, ctx: TContext) => Response | null;
  readonly withRegistryService: <T>(work: (service: InstanceRegistryService) => Promise<T>) => Promise<T>;
  readonly getActorId?: (ctx: TContext) => string | undefined;
};

const parseIncludeOnlyActive = (request: Request): boolean | Response => {
  const raw = new URL(request.url).searchParams.get('includeOnlyActive');
  if (raw === null || raw === '') {
    return true;
  }
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return new Response('invalid');
};

export const createInstanceRegistryAuditHttpHandlers = <TContext>(deps: InstanceRegistryAuditHttpDeps<TContext>) => ({
  getInstanceAuditRun: async (request: Request, ctx: TContext): Promise<Response> => {
    const accessError = deps.ensurePlatformAccess(request, ctx);
    if (accessError) {
      return accessError;
    }

    const includeOnlyActive = parseIncludeOnlyActive(request);
    if (includeOnlyActive instanceof Response) {
      return deps.createApiError(
        400,
        'invalid_request',
        'includeOnlyActive muss true oder false sein.',
        deps.getRequestId()
      );
    }

    const url = new URL(request.url);
    const instanceIds = url.searchParams
      .getAll('instanceId')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    try {
      const run = await deps.withRegistryService((service) =>
        service.runInstanceAudit({
          instanceIds: instanceIds.length > 0 ? instanceIds : undefined,
          includeOnlyActive,
          actorId: deps.getActorId?.(ctx),
          requestId: deps.getRequestId(),
        })
      );
      return deps.jsonResponse(200, deps.asApiItem(run, deps.getRequestId()));
    } catch (error) {
      return deps.mapReadError(error);
    }
  },

  getSingleInstanceAuditRun: async (request: Request, ctx: TContext): Promise<Response> => {
    const accessError = deps.ensurePlatformAccess(request, ctx);
    if (accessError) {
      return accessError;
    }

    const instanceId = readDetailInstanceId(request);
    if (!instanceId || instanceId === 'audit') {
      return deps.createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', deps.getRequestId());
    }

    try {
      const instanceExists = await deps.withRegistryService((service) => service.getInstanceDetail(instanceId));
      if (!instanceExists) {
        return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', deps.getRequestId());
      }

      const run = await deps.withRegistryService((service) =>
        service.runInstanceAudit({
          instanceIds: [instanceId],
          includeOnlyActive: false,
          actorId: deps.getActorId?.(ctx),
          requestId: deps.getRequestId(),
        })
      );

      return deps.jsonResponse(200, deps.asApiItem(run, deps.getRequestId()));
    } catch (error) {
      return deps.mapReadError(error);
    }
  },
});
