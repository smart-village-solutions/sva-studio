import { buildPrimaryHostname, normalizeHost } from '@sva/core';

import { createInstanceSchema, updateInstanceSchema } from './http-contracts.js';
import { buildCreateInstanceProvisioningInput, buildUpdateInstanceInput, type CreateInstancePayload, type UpdateInstancePayload } from './mutation-input-builders.js';
import { readInstanceIdOrError, requireMutationGuards, type InstanceRegistryHttpDeps } from './http-instance-shared.js';

export const createCreateInstanceHandler =
  <TContext>(deps: InstanceRegistryHttpDeps<TContext>) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
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
  };

export const createUpdateInstanceHandler =
  <TContext>(deps: InstanceRegistryHttpDeps<TContext>) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
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
  };
