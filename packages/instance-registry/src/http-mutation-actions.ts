import {
  executeKeycloakProvisioningSchema,
  probeTenantIamAccessSchema,
  reconcileKeycloakSchema,
} from './http-contracts.js';
import type { InstanceRegistryMutationHttpDeps } from './http-mutation-shared.js';
import { createScopedRegistryMutationHandler } from './http-mutation-shared.js';
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
  createScopedRegistryMutationHandler(deps, {
    parse: (request) => deps.parseRequestBody<ReconcileKeycloakPayload>(request, reconcileKeycloakSchema),
    execute: (service, input) =>
      service.reconcileKeycloak(
        buildReconcileInstanceKeycloakInput(input.instanceId, input.payload, {
          idempotencyKey: input.idempotencyKey,
          actorId: input.actorId,
          requestId: input.requestId,
        })
      ),
    respond: (status, state) =>
      status
        ? deps.jsonResponse(200, deps.asApiItem(status, state.requestId))
        : deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', state.requestId),
    mapMutationError,
  });

export const createExecuteInstanceKeycloakProvisioningHandler =
  <TContext>(
    deps: InstanceRegistryMutationHttpDeps<TContext>,
    mapMutationError: (error: unknown) => Response,
    options?: { readonly secretRotationOnly?: boolean }
  ) =>
  createScopedRegistryMutationHandler(deps, {
    ...(options?.secretRotationOnly ? { criticalActionId: 'instance.secret.rotate' } : {}),
    parse: async (request) => {
      const parsed = await deps.parseRequestBody<ExecuteKeycloakProvisioningPayload>(request, executeKeycloakProvisioningSchema);
      if (!parsed.ok) return parsed;
      const isRotation = parsed.data.intent === 'rotate_client_secret';
      return isRotation === Boolean(options?.secretRotationOnly)
        ? parsed
        : { ok: false, message: 'Ungültige Provisioning-Aktion für diesen Endpunkt.' } as const;
    },
    execute: (service, input) =>
      service.executeKeycloakProvisioning(
        buildExecuteInstanceKeycloakProvisioningInput(input.instanceId, input.payload, {
          idempotencyKey: input.idempotencyKey,
          actorId: input.actorId,
          requestId: input.requestId,
        })
      ),
    respond: (run, state) =>
      run
        ? deps.jsonResponse(200, deps.asApiItem(run, state.requestId))
        : deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', state.requestId),
    mapMutationError,
  });

export const createProbeTenantIamAccessHandler =
  <TContext>(deps: InstanceRegistryMutationHttpDeps<TContext>, mapMutationError: (error: unknown) => Response) =>
  createScopedRegistryMutationHandler(deps, {
    parse: (request) => deps.parseRequestBody<ProbeTenantIamAccessPayload>(request, probeTenantIamAccessSchema),
    execute: (service, input) =>
      service.probeTenantIamAccess(
        buildProbeTenantIamAccessInput(input.instanceId, {
          idempotencyKey: input.idempotencyKey,
          actorId: input.actorId,
          requestId: input.requestId,
        })
      ),
    respond: (status, state) =>
      status
        ? deps.jsonResponse(200, deps.asApiItem(status, state.requestId))
        : deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', state.requestId),
    mapMutationError,
  });
