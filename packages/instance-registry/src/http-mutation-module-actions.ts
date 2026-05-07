import type { InstanceStatus } from '@sva/core';

import { assignModuleSchema, revokeModuleSchema, seedIamBaselineSchema, statusMutationSchema } from './http-contracts.js';
import type { InstanceRegistryMutationHttpDeps } from './http-mutation-shared.js';
import {
  readInstanceIdOrError,
  requireIdempotencyKeyOrError,
  requireMutationGuards,
} from './http-mutation-shared.js';
import {
  buildAssignInstanceModuleInput,
  buildChangeInstanceStatusInput,
  buildRevokeInstanceModuleInput,
  buildSeedInstanceIamBaselineInput,
  type AssignInstanceModulePayload,
  type RevokeInstanceModulePayload,
} from './mutation-input-builders.js';

export const createAssignModuleHandler =
  <TContext>(deps: InstanceRegistryMutationHttpDeps<TContext>) =>
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

    const payloadResult = await deps.parseRequestBody<AssignInstanceModulePayload>(request, assignModuleSchema);
    if (!payloadResult.ok) {
      return deps.createApiError(400, 'invalid_request', payloadResult.message, deps.getRequestId());
    }

    const result = await deps.withRegistryService((service) =>
      service.assignModule(
        buildAssignInstanceModuleInput(instanceId, payloadResult.data, {
          idempotencyKey,
          actorId: deps.getActor(ctx).id,
          requestId: deps.getRequestId(),
        })
      )
    );

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', deps.getRequestId());
      }
      if (result.reason === 'unknown_module') {
        return deps.createApiError(400, 'invalid_request', 'Unbekanntes Modul.', deps.getRequestId());
      }
      return deps.createApiError(409, 'conflict', 'Modul konnte nicht zugewiesen werden.', deps.getRequestId());
    }

    return deps.jsonResponse(200, deps.asApiItem(result.instance, deps.getRequestId()));
  };

export const createRevokeModuleHandler =
  <TContext>(deps: InstanceRegistryMutationHttpDeps<TContext>) =>
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

    const payloadResult = await deps.parseRequestBody<RevokeInstanceModulePayload>(request, revokeModuleSchema);
    if (!payloadResult.ok) {
      return deps.createApiError(400, 'invalid_request', payloadResult.message, deps.getRequestId());
    }

    const result = await deps.withRegistryService((service) =>
      service.revokeModule(
        buildRevokeInstanceModuleInput(instanceId, payloadResult.data, {
          idempotencyKey,
          actorId: deps.getActor(ctx).id,
          requestId: deps.getRequestId(),
        })
      )
    );

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', deps.getRequestId());
      }
      if (result.reason === 'unknown_module') {
        return deps.createApiError(400, 'invalid_request', 'Unbekanntes Modul.', deps.getRequestId());
      }
      return deps.createApiError(409, 'conflict', 'Modul konnte nicht entzogen werden.', deps.getRequestId());
    }

    return deps.jsonResponse(200, deps.asApiItem(result.instance, deps.getRequestId()));
  };

export const createSeedIamBaselineHandler =
  <TContext>(deps: InstanceRegistryMutationHttpDeps<TContext>) =>
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

    const payloadResult = await deps.parseRequestBody<Record<string, never>>(request, seedIamBaselineSchema);
    if (!payloadResult.ok) {
      return deps.createApiError(400, 'invalid_request', payloadResult.message, deps.getRequestId());
    }

    const result = await deps.withRegistryService((service) =>
      service.seedIamBaseline(
        buildSeedInstanceIamBaselineInput(instanceId, {
          idempotencyKey,
          actorId: deps.getActor(ctx).id,
          requestId: deps.getRequestId(),
        })
      )
    );

    if (!result.ok) {
      return deps.createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', deps.getRequestId());
    }

    return deps.jsonResponse(200, deps.asApiItem(result.instance, deps.getRequestId()));
  };

export const createMutateInstanceStatusHandler =
  <TContext>(deps: InstanceRegistryMutationHttpDeps<TContext>) =>
  async (
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
      return deps.createApiError(409, 'conflict', 'Statuswechsel ist im aktuellen Zustand nicht erlaubt.', deps.getRequestId());
    }

    return deps.jsonResponse(200, deps.asApiItem(result.instance, deps.getRequestId()));
  };
