import type { InstanceStatus } from '@sva/core';
import type { z } from 'zod';

import { readDetailInstanceId } from './http-contracts.js';
import type { InstanceRegistryService } from './service-types.js';

export type CreateApiError = (
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
) => Response;

export type JsonResponse = (status: number, payload: unknown) => Response;
export type AsApiItem = <T>(value: T, requestId?: string) => unknown;
export type AsApiList = <T>(
  value: readonly T[],
  pagination: { page: number; pageSize: number; total: number },
  requestId?: string
) => unknown;
export type ParseRequestBody = <T>(
  request: Request,
  schema: z.ZodSchema<T>
) => Promise<{ ok: true; data: T } | { ok: false; message: string }>;
export type RequireIdempotencyKey = (
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
  readonly requireFreshReauth: (request: Request, ctx: TContext) => Response | null;
  readonly withRegistryService: <T>(work: (service: InstanceRegistryService) => Promise<T>) => Promise<T>;
  readonly onInstanceProvisioningRequested?: (event: {
    readonly instanceId: string;
    readonly primaryHostname: string;
    readonly actorId: string;
  }) => void;
};

export const requireMutationGuards = <TContext>(
  deps: InstanceRegistryHttpDeps<TContext>,
  request: Request,
  ctx: TContext,
  options?: { readonly requireFreshReauth?: boolean }
): Response | null => {
  const accessError = deps.ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }
  const csrfError = deps.validateCsrf(request, deps.getRequestId());
  if (csrfError) {
    return csrfError;
  }
  if (options?.requireFreshReauth === false) {
    return null;
  }
  return deps.requireFreshReauth(request, ctx);
};

export const readInstanceIdOrError = <TContext>(
  deps: InstanceRegistryHttpDeps<TContext>,
  request: Request
): string | Response => {
  const instanceId = readDetailInstanceId(request);
  return instanceId ?? deps.createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', deps.getRequestId());
};

export type InstanceRegistryStatusMutation = Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>;
