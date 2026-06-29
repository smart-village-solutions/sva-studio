import {
  executeKeycloakProvisioningSchema,
  probeTenantIamAccessSchema,
  reconcileKeycloakSchema,
} from './http-contracts.js';
import type { InstanceRegistryMutationHttpDeps } from './http-mutation-shared.js';
import {
  readInstanceIdOrError,
  requireIdempotencyKeyOrError,
  requireMutationGuards,
  withScopedRegistryMutation,
} from './http-mutation-shared.js';
import {
  buildExecuteInstanceKeycloakProvisioningInput,
  buildProbeTenantIamAccessInput,
  buildReconcileInstanceKeycloakInput,
  type ExecuteKeycloakProvisioningPayload,
  type ProbeTenantIamAccessPayload,
  type ReconcileKeycloakPayload,
} from './mutation-input-builders.js';

export const createReconcileInstanceKeycloakHandler =
  <TContext>(deps: InstanceRegistryMutationHttpDeps<TContext>, mapMutationError: (error: unknown) => Response) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
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
      const status = await withScopedRegistryMutation(deps, instanceId, (service) =>
        service.reconcileKeycloak(buildReconcileInstanceKeycloakInput(instanceId, payloadResult.data, {
          idempotencyKey,
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
  };

export const createExecuteInstanceKeycloakProvisioningHandler =
  <TContext>(deps: InstanceRegistryMutationHttpDeps<TContext>, mapMutationError: (error: unknown) => Response) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
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
      const run = await withScopedRegistryMutation(deps, instanceId, (service) =>
        service.executeKeycloakProvisioning(buildExecuteInstanceKeycloakProvisioningInput(instanceId, payloadResult.data, {
          idempotencyKey,
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
  };

export const createProbeTenantIamAccessHandler =
  <TContext>(deps: InstanceRegistryMutationHttpDeps<TContext>, mapMutationError: (error: unknown) => Response) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
    const guardError = requireMutationGuards(deps, request, ctx, { requireFreshReauth: false });
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

    const payloadResult = await deps.parseRequestBody<ProbeTenantIamAccessPayload>(request, probeTenantIamAccessSchema);
    if (!payloadResult.ok) {
      return deps.createApiError(400, 'invalid_request', payloadResult.message, deps.getRequestId());
    }

    try {
      const status = await withScopedRegistryMutation(deps, instanceId, (service) =>
        service.probeTenantIamAccess(
          buildProbeTenantIamAccessInput(instanceId, {
            idempotencyKey,
            actorId: deps.getActor(ctx).id,
            requestId: deps.getRequestId(),
          })
        )
      );
      if (!status) {
        return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', deps.getRequestId());
      }
      return deps.jsonResponse(200, deps.asApiItem(status, deps.getRequestId()));
    } catch (error) {
      return mapMutationError(error);
    }
  };
