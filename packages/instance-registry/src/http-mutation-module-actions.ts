import type { InstanceStatus } from '@sva/core';

import {
  assignModuleSchema,
  bootstrapAdminStructureSchema,
  revokeModuleSchema,
  seedIamBaselineSchema,
  statusMutationSchema,
} from './http-contracts.js';
import type { InstanceRegistryMutationHttpDeps } from './http-mutation-shared.js';
import { createScopedRegistryMutationHandler } from './http-mutation-shared.js';
import {
  buildAssignInstanceModuleInput,
  buildBootstrapAdminStructureInput,
  buildChangeInstanceStatusInput,
  buildRevokeInstanceModuleInput,
  buildSeedInstanceIamBaselineInput,
  type AssignInstanceModulePayload,
  type BootstrapAdminStructurePayload,
  type RevokeInstanceModulePayload,
} from './mutation-input-builders.js';

export const createAssignModuleHandler =
  <TContext>(
    deps: InstanceRegistryMutationHttpDeps<TContext>,
    mapMutationError: (error: unknown) => Response
  ) =>
  createScopedRegistryMutationHandler(deps, {
    parse: (request) => deps.parseRequestBody<AssignInstanceModulePayload>(request, assignModuleSchema),
    execute: (service, input) =>
      service.assignModule(
        buildAssignInstanceModuleInput(input.instanceId, input.payload, {
          idempotencyKey: input.idempotencyKey,
          actorId: input.actorId,
          requestId: input.requestId,
        })
      ),
    respond: (result, state) => {
      if (!result.ok) {
        if (result.reason === 'not_found') {
          return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', state.requestId);
        }
        if (result.reason === 'unknown_module') {
          return deps.createApiError(400, 'invalid_request', 'Unbekanntes Modul.', state.requestId);
        }
        return deps.createApiError(409, 'conflict', 'Modul konnte nicht zugewiesen werden.', state.requestId);
      }

      return deps.jsonResponse(200, deps.asApiItem(result.instance, state.requestId));
    },
    mapMutationError,
  });

export const createBootstrapAdminStructureHandler =
  <TContext>(
    deps: InstanceRegistryMutationHttpDeps<TContext>,
    mapMutationError: (error: unknown) => Response
  ) =>
  createScopedRegistryMutationHandler(deps, {
    parse: (request) => deps.parseRequestBody<BootstrapAdminStructurePayload>(request, bootstrapAdminStructureSchema),
    execute: (service, input) =>
      service.bootstrapAdminStructure(
        buildBootstrapAdminStructureInput(input.instanceId, input.payload, {
          idempotencyKey: input.idempotencyKey,
          actorId: input.actorId,
          requestId: input.requestId,
        })
      ),
    respond: (result, state) => {
      if (!result.ok) {
        if (result.reason === 'not_found') {
          return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', state.requestId);
        }
        if (result.reason === 'unknown_module') {
          return deps.createApiError(400, 'invalid_request', 'Unbekanntes Modul.', state.requestId);
        }
        return deps.createApiError(409, 'conflict', 'Admin-Struktur konnte nicht initialisiert werden.', state.requestId);
      }

      return deps.jsonResponse(200, deps.asApiItem(result.instance, state.requestId));
    },
    mapMutationError,
  });

export const createRevokeModuleHandler =
  <TContext>(
    deps: InstanceRegistryMutationHttpDeps<TContext>,
    mapMutationError: (error: unknown) => Response
  ) =>
  createScopedRegistryMutationHandler(deps, {
    parse: (request) => deps.parseRequestBody<RevokeInstanceModulePayload>(request, revokeModuleSchema),
    execute: (service, input) =>
      service.revokeModule(
        buildRevokeInstanceModuleInput(input.instanceId, input.payload, {
          idempotencyKey: input.idempotencyKey,
          actorId: input.actorId,
          requestId: input.requestId,
        })
      ),
    respond: (result, state) => {
      if (!result.ok) {
        if (result.reason === 'not_found') {
          return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', state.requestId);
        }
        if (result.reason === 'unknown_module') {
          return deps.createApiError(400, 'invalid_request', 'Unbekanntes Modul.', state.requestId);
        }
        return deps.createApiError(409, 'conflict', 'Modul konnte nicht entzogen werden.', state.requestId);
      }

      return deps.jsonResponse(200, deps.asApiItem(result.instance, state.requestId));
    },
    mapMutationError,
  });

export const createSeedIamBaselineHandler =
  <TContext>(
    deps: InstanceRegistryMutationHttpDeps<TContext>,
    mapMutationError: (error: unknown) => Response
  ) =>
  createScopedRegistryMutationHandler(deps, {
    parse: (request) => deps.parseRequestBody<Record<string, never>>(request, seedIamBaselineSchema),
    execute: (service, input) =>
      service.seedIamBaseline(
        buildSeedInstanceIamBaselineInput(input.instanceId, {
          idempotencyKey: input.idempotencyKey,
          actorId: input.actorId,
          requestId: input.requestId,
        })
      ),
    respond: (result, state) =>
      result.ok
        ? deps.jsonResponse(200, deps.asApiItem(result.instance, state.requestId))
        : deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', state.requestId),
    mapMutationError,
  });

export const createMutateInstanceStatusHandler =
  <TContext>(
    deps: InstanceRegistryMutationHttpDeps<TContext>,
    mapMutationError: (error: unknown) => Response
  ) => {
  const createStatusMutationHandler = (nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>) =>
    createScopedRegistryMutationHandler(deps, {
      parse: async (inputRequest) => {
        const payloadResult = await deps.parseRequestBody<{ status: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'> }>(
          inputRequest,
          statusMutationSchema
        );
        if (!payloadResult.ok) {
          return payloadResult;
        }
        if (payloadResult.data.status !== nextStatus) {
          return { ok: false, message: 'Ungültiger Statuswechsel.' } as const;
        }
        return payloadResult;
      },
      execute: (service, input) =>
        service.changeStatus(
          buildChangeInstanceStatusInput(input.instanceId, nextStatus, {
            idempotencyKey: input.idempotencyKey,
            actorId: input.actorId,
            requestId: input.requestId,
          })
        ),
      respond: (result, state) => {
        if (!result.ok) {
          if (result.reason === 'not_found') {
            return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', state.requestId);
          }
          return deps.createApiError(409, 'conflict', 'Statuswechsel ist im aktuellen Zustand nicht erlaubt.', state.requestId);
        }

        return deps.jsonResponse(200, deps.asApiItem(result.instance, state.requestId));
      },
      mapMutationError,
    });

  const handlers = {
    active: createStatusMutationHandler('active'),
    suspended: createStatusMutationHandler('suspended'),
    archived: createStatusMutationHandler('archived'),
  } satisfies Record<Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>, (request: Request, ctx: TContext) => Promise<Response>>;

  return (request: Request, ctx: TContext, nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>): Promise<Response> =>
    handlers[nextStatus](request, ctx);
};
