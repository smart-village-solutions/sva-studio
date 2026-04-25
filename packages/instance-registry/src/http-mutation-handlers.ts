import type { InstanceStatus } from '@sva/core';

import {
  executeKeycloakProvisioningSchema,
  readDetailInstanceId,
  reconcileKeycloakSchema,
  statusMutationSchema,
} from './http-contracts.js';
import { classifyInstanceMutationError, type InstanceMutationErrorCode } from './mutation-errors.js';
import {
  buildChangeInstanceStatusInput,
  buildExecuteInstanceKeycloakProvisioningInput,
  buildReconcileInstanceKeycloakInput,
  type ExecuteKeycloakProvisioningPayload,
  type ReconcileKeycloakPayload,
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
type ParseRequestBody = <T>(
  request: Request,
  schema: unknown
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
  readonly requireFreshReauth: (request: Request) => Response | null;
  readonly withRegistryService: <T>(work: (service: InstanceRegistryService) => Promise<T>) => Promise<T>;
};

const mutationErrorMessages: Record<InstanceMutationErrorCode, string> = {
  tenant_admin_client_not_configured:
    'Für diese Instanz ist noch kein Tenant-Admin-Client hinterlegt.',
  tenant_admin_client_secret_missing:
    'Für diese Instanz ist noch kein Tenant-Admin-Client-Secret hinterlegt.',
  tenant_auth_client_secret_missing:
    'Für diese Instanz ist noch kein Tenant-Client-Secret hinterlegt.',
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

const requireMutationGuards = <TContext>(
  deps: InstanceRegistryMutationHttpDeps<TContext>,
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
  deps: InstanceRegistryMutationHttpDeps<TContext>,
  request: Request
): string | Response => {
  const instanceId = readDetailInstanceId(request);
  return instanceId ?? deps.createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', deps.getRequestId());
};

const requireIdempotencyKeyOrError = <TContext>(
  deps: InstanceRegistryMutationHttpDeps<TContext>,
  request: Request
): string | Response => {
  const idempotencyResult = deps.requireIdempotencyKey(request, deps.getRequestId());
  return 'error' in idempotencyResult ? idempotencyResult.error : idempotencyResult.key;
};

export const createInstanceRegistryMutationHttpHandlers = <TContext>(
  deps: InstanceRegistryMutationHttpDeps<TContext>
) => {
  const mapMutationError = createInstanceMutationErrorMapper(deps);

  return {
    reconcileInstanceKeycloak: async (request: Request, ctx: TContext): Promise<Response> => {
      const guardError = requireMutationGuards(deps, request, ctx);
      if (guardError) {
        return guardError;
      }

      const idempotencyKey = requireIdempotencyKeyOrError(deps, request);
      if (idempotencyKey instanceof Response) {
        return idempotencyKey;
      }

      const instanceId = readInstanceIdOrError(deps, request);
      if (instanceId instanceof Response) {
        return instanceId;
      }

      const payloadResult = await deps.parseRequestBody<ReconcileKeycloakPayload>(request, reconcileKeycloakSchema);
      if (!payloadResult.ok) {
        return deps.createApiError(400, 'invalid_request', payloadResult.message, deps.getRequestId());
      }

      try {
        const status = await deps.withRegistryService((service) =>
          service.reconcileKeycloak(buildReconcileInstanceKeycloakInput(instanceId, payloadResult.data, {
            actorId: deps.getActor(ctx).id,
            requestId: deps.getRequestId(),
          }))
        );
        if (!status) {
          return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', deps.getRequestId());
        }
        return deps.jsonResponse(200, deps.asApiItem(status, deps.getRequestId()));
      } catch (error) {
        return mapMutationError(error);
      }
    },

    executeInstanceKeycloakProvisioning: async (request: Request, ctx: TContext): Promise<Response> => {
      const guardError = requireMutationGuards(deps, request, ctx);
      if (guardError) {
        return guardError;
      }

      const idempotencyKey = requireIdempotencyKeyOrError(deps, request);
      if (idempotencyKey instanceof Response) {
        return idempotencyKey;
      }

      const instanceId = readInstanceIdOrError(deps, request);
      if (instanceId instanceof Response) {
        return instanceId;
      }

      const payloadResult = await deps.parseRequestBody<ExecuteKeycloakProvisioningPayload>(
        request,
        executeKeycloakProvisioningSchema
      );
      if (!payloadResult.ok) {
        return deps.createApiError(400, 'invalid_request', payloadResult.message, deps.getRequestId());
      }

      try {
        const run = await deps.withRegistryService((service) =>
          service.executeKeycloakProvisioning(buildExecuteInstanceKeycloakProvisioningInput(instanceId, payloadResult.data, {
            actorId: deps.getActor(ctx).id,
            requestId: deps.getRequestId(),
          }))
        );
        if (!run) {
          return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', deps.getRequestId());
        }
        return deps.jsonResponse(200, deps.asApiItem(run, deps.getRequestId()));
      } catch (error) {
        return mapMutationError(error);
      }
    },

    mutateInstanceStatus: async (
      request: Request,
      ctx: TContext,
      nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>
    ): Promise<Response> => {
      const guardError = requireMutationGuards(deps, request, ctx);
      if (guardError) {
        return guardError;
      }

      const idempotencyKey = requireIdempotencyKeyOrError(deps, request);
      if (idempotencyKey instanceof Response) {
        return idempotencyKey;
      }

      const payloadResult = await deps.parseRequestBody<{ status: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'> }>(
        request,
        statusMutationSchema
      );
      if (!payloadResult.ok || payloadResult.data.status !== nextStatus) {
        return deps.createApiError(400, 'invalid_request', 'Ungültiger Statuswechsel.', deps.getRequestId());
      }

      const instanceId = readInstanceIdOrError(deps, request);
      if (instanceId instanceof Response) {
        return instanceId;
      }

      const result = await deps.withRegistryService((service) =>
        service.changeStatus(buildChangeInstanceStatusInput(instanceId, nextStatus, {
          idempotencyKey,
          actorId: deps.getActor(ctx).id,
          requestId: deps.getRequestId(),
        }))
      );

      if (!result.ok) {
        if (result.reason === 'not_found') {
          return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', deps.getRequestId());
        }
        return deps.createApiError(
          409,
          'conflict',
          'Statuswechsel ist im aktuellen Zustand nicht erlaubt.',
          deps.getRequestId()
        );
      }

      return deps.jsonResponse(200, deps.asApiItem(result.instance, deps.getRequestId()));
    },
  };
};
