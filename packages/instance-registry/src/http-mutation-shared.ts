import type { z } from 'zod';

import { readDetailInstanceId } from './http-contracts.js';
import { classifyInstanceMutationError, type InstanceMutationErrorCode } from './mutation-errors.js';
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
type ParseRequestBody = <T>(
  request: Request,
  schema: z.ZodSchema<T>
) => Promise<{ ok: true; data: T } | { ok: false; message: string }>;
type RequireIdempotencyKey = (
  request: Request,
  requestId?: string
) => { key: string } | { error: Response };

export type InstanceRegistryMutationHttpActor = {
  readonly id: string;
};

export type InstanceRegistryMutationHttpDeps<TContext> = {
  readonly getRequestId: () => string | undefined;
  readonly getActor: (ctx: TContext) => InstanceRegistryMutationHttpActor;
  readonly createApiError: CreateApiError;
  readonly jsonResponse: JsonResponse;
  readonly asApiItem: AsApiItem;
  readonly parseRequestBody: ParseRequestBody;
  readonly requireIdempotencyKey: RequireIdempotencyKey;
  readonly ensurePlatformAccess: (request: Request, ctx: TContext) => Response | null;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
  readonly requireFreshReauth: (request: Request, ctx: TContext) => Response | null;
  readonly withRegistryService: <T>(work: (service: InstanceRegistryService) => Promise<T>) => Promise<T>;
};

const mutationErrorMessages: Record<InstanceMutationErrorCode, string> = {
  tenant_admin_client_not_configured:
    'Für diese Instanz ist noch kein Tenant-Admin-Client hinterlegt.',
  tenant_admin_client_secret_missing:
    'Für diese Instanz ist noch kein Tenant-Admin-Client-Secret hinterlegt.',
  tenant_auth_client_secret_missing:
    'Für diese Instanz ist noch kein Tenant-Client-Secret hinterlegt.',
  idempotency_key_reuse:
    'Idempotency-Key wurde bereits mit anderem Payload verwendet.',
  encryption_not_configured:
    'Die Feldverschlüsselung für Tenant-Secrets ist nicht konfiguriert.',
  keycloak_unavailable:
    'Keycloak konnte für diese Instanz nicht abgeglichen werden.',
};

export const createInstanceMutationErrorMapper = (
  deps: Pick<InstanceRegistryMutationHttpDeps<unknown>, 'createApiError' | 'getRequestId'>
) => (error: unknown): Response => {
  const classification = classifyInstanceMutationError(error);
  return deps.createApiError(
    classification.status,
    classification.code,
    mutationErrorMessages[classification.code],
    deps.getRequestId(),
    classification.details
  );
};

export const requireMutationGuards = <TContext>(
  deps: InstanceRegistryMutationHttpDeps<TContext>,
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
  return null;
};

export const readInstanceIdOrError = <TContext>(
  deps: InstanceRegistryMutationHttpDeps<TContext>,
  request: Request
): string | Response => {
  const instanceId = readDetailInstanceId(request);
  return instanceId ?? deps.createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', deps.getRequestId());
};

export const requireIdempotencyKeyOrError = <TContext>(
  deps: InstanceRegistryMutationHttpDeps<TContext>,
  request: Request
): string | Response => {
  const idempotencyResult = deps.requireIdempotencyKey(request, deps.getRequestId());
  return 'error' in idempotencyResult ? idempotencyResult.error : idempotencyResult.key;
};
