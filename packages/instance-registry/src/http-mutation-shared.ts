import { createMutationWorkflow } from '@sva/server-runtime';
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
  readonly withScopedRegistryService: <T>(
    instanceId: string,
    work: (service: InstanceRegistryService) => Promise<T>
  ) => Promise<T>;
  readonly confirmCriticalMutation?: (input: {
    readonly service: InstanceRegistryService;
    readonly request: Request;
    readonly context: TContext;
    readonly instanceId: string;
    readonly actorId: string;
    readonly actionId: string;
    readonly moduleId?: string;
  }) => Promise<Response | null>;
};

type ParsedRequestBody<TData> =
  | { readonly ok: true; readonly data: TData }
  | { readonly ok: false; readonly message: string };

type ScopedRegistryMutationState<TContext> = {
  readonly request: Request;
  readonly context: TContext;
  readonly requestId?: string;
  readonly actorId: string;
  readonly instanceId: string;
  readonly idempotencyKey: string;
};

type ScopedRegistryMutationExecuteInput<TData> = {
  readonly instanceId: string;
  readonly payload: TData;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly requestId?: string;
};

type ScopedRegistryMutationHandlerOptions<TContext, TData, TResult> = {
  readonly criticalActionId?: string;
  readonly resolveCriticalModuleId?: (payload: TData) => string | undefined;
  readonly parse: (request: Request) => Promise<ParsedRequestBody<TData>>;
  readonly execute: (
    service: InstanceRegistryService,
    input: ScopedRegistryMutationExecuteInput<TData>
  ) => Promise<TResult>;
  readonly respond: (result: TResult, state: ScopedRegistryMutationState<TContext>) => Response;
  readonly mapMutationError: (error: unknown) => Response;
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
  database_unavailable:
    'Die Instanzverwaltung konnte wegen eines Datenbank- oder Schemafehlers nicht abgeschlossen werden.',
  encryption_not_configured:
    'Die Feldverschlüsselung für Tenant-Secrets ist nicht konfiguriert.',
  keycloak_unavailable:
    'Keycloak konnte für diese Instanz nicht abgeglichen werden.',
  internal_unclassified:
    'Die Instanzverwaltung konnte nicht abgeschlossen werden. Bitte die Request-ID für die Diagnose verwenden.',
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

export const withScopedRegistryMutation = <TContext, TResult>(
  deps: InstanceRegistryMutationHttpDeps<TContext>,
  instanceId: string,
  work: (service: InstanceRegistryService) => Promise<TResult>
): Promise<TResult> => deps.withScopedRegistryService(instanceId, work);

type ScopedExecutionState<TContext, TData> = {
  readonly request: Request;
  readonly context: TContext;
  readonly instanceId: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly requestId?: string;
  readonly input: TData;
};

const executeScopedMutation = <TContext, TData, TResult>(
  deps: InstanceRegistryMutationHttpDeps<TContext>,
  options: ScopedRegistryMutationHandlerOptions<TContext, TData, TResult>,
  state: ScopedExecutionState<TContext, TData>
): Promise<TResult | Response> => withScopedRegistryMutation(deps, state.instanceId, async (service) => {
  if (options.criticalActionId) {
    if (!deps.confirmCriticalMutation) {
      return deps.createApiError(500, 'internal_error', 'Bestätigungsprüfung für kritische Aktion ist nicht verfügbar.', state.requestId);
    }
    const moduleId = options.resolveCriticalModuleId?.(state.input);
    const confirmationError = await deps.confirmCriticalMutation({
      service,
      request: state.request,
      context: state.context,
      instanceId: state.instanceId,
      actorId: state.actorId,
      actionId: options.criticalActionId,
      ...(moduleId ? { moduleId } : {}),
    });
    if (confirmationError) return confirmationError;
  }
  return options.execute(service, {
    instanceId: state.instanceId,
    payload: state.input,
    actorId: state.actorId,
    idempotencyKey: state.idempotencyKey,
    requestId: state.requestId,
  });
});

export const createScopedRegistryMutationHandler = <TContext, TData, TResult>(
  deps: InstanceRegistryMutationHttpDeps<TContext>,
  options: ScopedRegistryMutationHandlerOptions<TContext, TData, TResult>
) => {
  const workflow = createMutationWorkflow<
    TContext,
    {
      readonly requestId?: string;
      readonly actorId: string;
      readonly instanceId: string;
    },
    Record<never, never>,
    {
      readonly idempotencyKey: string;
    },
    TData,
    TResult | Response
  >({
    prepare: ({ request, context }: { readonly request: Request; readonly context: TContext }) => {
      const instanceId = readInstanceIdOrError(deps, request);
      if (instanceId instanceof Response) {
        return instanceId;
      }

      return {
        requestId: deps.getRequestId(),
        actorId: deps.getActor(context).id,
        instanceId,
      };
    },
    authorize: ({ request, context }: { readonly request: Request; readonly context: TContext }) =>
      deps.ensurePlatformAccess(request, context) ?? {},
    csrf: ({ request, requestId }: { readonly request: Request; readonly requestId?: string }) =>
      deps.validateCsrf(request, requestId) ?? undefined,
    idempotency: ({ request, requestId }: { readonly request: Request; readonly requestId?: string }) => {
      const idempotencyResult = deps.requireIdempotencyKey(request, requestId);
      return 'error' in idempotencyResult ? idempotencyResult.error : { idempotencyKey: idempotencyResult.key };
    },
    parse: async ({ request, requestId }: { readonly request: Request; readonly requestId?: string }) => {
      const parsed = await options.parse(request);
      return parsed.ok ? parsed.data : deps.createApiError(400, 'invalid_request', parsed.message, requestId);
    },
    execute: (state: ScopedExecutionState<TContext, TData>) => executeScopedMutation(deps, options, state),
    mapError: options.mapMutationError,
    respond: (
      result: TResult | Response,
      state: {
        readonly request: Request;
        readonly context: TContext;
        readonly requestId?: string;
        readonly actorId: string;
        readonly instanceId: string;
        readonly idempotencyKey: string;
      }
    ) =>
      result instanceof Response ? result : options.respond(result, {
        request: state.request,
        context: state.context,
        requestId: state.requestId,
        actorId: state.actorId,
        instanceId: state.instanceId,
        idempotencyKey: state.idempotencyKey,
      }),
  });

  return (request: Request, context: TContext): Promise<Response> => workflow(request, context);
};

export const requireMutationGuards = <TContext>(
  deps: InstanceRegistryMutationHttpDeps<TContext>,
  request: Request,
  ctx: TContext,
  _options?: { readonly requireFreshReauth?: boolean }
): Response | null => {
  void _options;
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
