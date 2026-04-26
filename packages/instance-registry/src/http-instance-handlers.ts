import { buildPrimaryHostname, normalizeHost, type InstanceStatus } from '@sva/core';
import type { z } from 'zod';

import {
  createInstanceSchema,
  listQuerySchema,
  readDetailInstanceId,
  updateInstanceSchema,
} from './http-contracts.js';
import {
  buildCreateInstanceProvisioningInput,
  buildUpdateInstanceInput,
  type CreateInstancePayload,
  type UpdateInstancePayload,
} from './mutation-input-builders.js';
import type { InstanceRegistryService } from './service-types.js';

type CreateApiError = (
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
) => Response;

type JsonResponse = (status: number, payload: unknown) => Response;
type AsApiItem = <T>(value: T, requestId?: string) => unknown;
type AsApiList = <T>(
  value: readonly T[],
  pagination: { page: number; pageSize: number; total: number },
  requestId?: string
) => unknown;
type ParseRequestBody = <T>(
  request: Request,
  schema: z.ZodSchema<T>
) => Promise<{ ok: true; data: T } | { ok: false; message: string }>;
type RequireIdempotencyKey = (
  request: Request,
  requestId?: string
) => { key: string } | { error: Response };

export type InstanceRegistryHttpActor = {
  readonly id: string;
};

export type InstanceRegistryHttpDeps<TContext> = {
  readonly getRequestId: () => string | undefined;
  readonly getActor: (ctx: TContext) => InstanceRegistryHttpActor;
  readonly createApiError: CreateApiError;
  readonly jsonResponse: JsonResponse;
  readonly asApiItem: AsApiItem;
  readonly asApiList: AsApiList;
  readonly parseRequestBody: ParseRequestBody;
  readonly requireIdempotencyKey: RequireIdempotencyKey;
  readonly mapMutationError: (error: unknown) => Response;
  readonly ensurePlatformAccess: (request: Request, ctx: TContext) => Response | null;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
  readonly requireFreshReauth: (request: Request) => Response | null;
  readonly withRegistryService: <T>(work: (service: InstanceRegistryService) => Promise<T>) => Promise<T>;
  readonly onInstanceProvisioningRequested?: (event: {
    readonly instanceId: string;
    readonly primaryHostname: string;
    readonly actorId: string;
  }) => void;
};

const requireMutationGuards = <TContext>(
  deps: InstanceRegistryHttpDeps<TContext>,
  request: Request,
  ctx: TContext
): Response | null => {
  const accessError = deps.ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }
  const csrfError = deps.validateCsrf(request, deps.getRequestId());
  if (csrfError) {
    return csrfError;
  }
  return deps.requireFreshReauth(request);
};

const readInstanceIdOrError = <TContext>(
  deps: InstanceRegistryHttpDeps<TContext>,
  request: Request
): string | Response => {
  const instanceId = readDetailInstanceId(request);
  return instanceId ?? deps.createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', deps.getRequestId());
};

export const createInstanceRegistryHttpHandlers = <TContext>(
  deps: InstanceRegistryHttpDeps<TContext>
) => ({
  listInstances: async (request: Request, ctx: TContext): Promise<Response> => {
    const accessError = deps.ensurePlatformAccess(request, ctx);
    if (accessError) {
      return accessError;
    }

    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      search: url.searchParams.get('search') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    });

    if (!parsed.success) {
      return deps.createApiError(400, 'invalid_request', 'Ungültige Filter für die Instanzverwaltung.', deps.getRequestId());
    }

    const enriched = await deps.withRegistryService((service) => service.listInstances(parsed.data));
    return deps.jsonResponse(
      200,
      deps.asApiList(enriched, { page: 1, pageSize: enriched.length, total: enriched.length }, deps.getRequestId())
    );
  },

  getInstance: async (request: Request, ctx: TContext): Promise<Response> => {
    const accessError = deps.ensurePlatformAccess(request, ctx);
    if (accessError) {
      return accessError;
    }

    const instanceId = readInstanceIdOrError(deps, request);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const instance = await deps.withRegistryService((service) => service.getInstanceDetail(instanceId));
    if (!instance) {
      return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', deps.getRequestId());
    }

    return deps.jsonResponse(200, deps.asApiItem(instance, deps.getRequestId()));
  },

  createInstance: async (request: Request, ctx: TContext): Promise<Response> => {
    const guardError = requireMutationGuards(deps, request, ctx);
    if (guardError) {
      return guardError;
    }

    const idempotencyResult = deps.requireIdempotencyKey(request, deps.getRequestId());
    if ('error' in idempotencyResult) {
      return idempotencyResult.error;
    }

    const payloadResult = await deps.parseRequestBody<CreateInstancePayload>(request, createInstanceSchema);
    if (!payloadResult.ok) {
      return deps.createApiError(400, 'invalid_request', payloadResult.message, deps.getRequestId());
    }

    const actor = deps.getActor(ctx);
    const result = await deps.withRegistryService((service) =>
      service.createProvisioningRequest(buildCreateInstanceProvisioningInput(payloadResult.data, {
        idempotencyKey: idempotencyResult.key,
        actorId: actor.id,
        requestId: deps.getRequestId(),
      }))
    );

    if (!result.ok) {
      return deps.createApiError(409, 'conflict', 'Instanz-ID ist bereits vergeben.', deps.getRequestId());
    }

    deps.onInstanceProvisioningRequested?.({
      instanceId: result.instance.instanceId,
      primaryHostname: buildPrimaryHostname(result.instance.instanceId, normalizeHost(payloadResult.data.parentDomain)),
      actorId: actor.id,
    });

    return deps.jsonResponse(201, deps.asApiItem(result.instance, deps.getRequestId()));
  },

  updateInstance: async (request: Request, ctx: TContext): Promise<Response> => {
    const guardError = requireMutationGuards(deps, request, ctx);
    if (guardError) {
      return guardError;
    }

    const instanceId = readInstanceIdOrError(deps, request);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const payloadResult = await deps.parseRequestBody<UpdateInstancePayload>(request, updateInstanceSchema);
    if (!payloadResult.ok) {
      return deps.createApiError(400, 'invalid_request', payloadResult.message, deps.getRequestId());
    }

    try {
      const updated = await deps.withRegistryService((service) =>
        service.updateInstance(buildUpdateInstanceInput(instanceId, payloadResult.data, {
          actorId: deps.getActor(ctx).id,
          requestId: deps.getRequestId(),
        }))
      );

      if (!updated) {
        return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', deps.getRequestId());
      }

      return deps.jsonResponse(200, deps.asApiItem(updated, deps.getRequestId()));
    } catch (error) {
      return deps.mapMutationError(error);
    }
  },
});

export type InstanceRegistryStatusMutation = Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>;
