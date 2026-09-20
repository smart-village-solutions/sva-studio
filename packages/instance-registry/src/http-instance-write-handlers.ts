import { buildPrimaryHostname, normalizeHost } from '@sva/core';

import {
  createInstanceSchema,
  resolveCreateInstanceDefaults,
  updateInstanceSchema,
} from './http-contracts.js';
import {
  buildCreateInstanceProvisioningInput,
  buildUpdateInstanceInput,
  type CreateInstancePayload,
  type UpdateInstancePayload,
} from './mutation-input-builders.js';
import {
  readInstanceIdOrError,
  requireMutationGuards,
  type InstanceRegistryHttpDeps,
} from './http-instance-shared.js';
import { mutationErrorMessages } from './http-mutation-error-messages.js';
import type { InstanceRegistryService } from './service-types.js';

const findReservedOidcClientId = (
  input: Pick<CreateInstancePayload, 'authClientId' | 'tenantAdminClient'>,
  reservedClientIds: readonly string[] | undefined
): string | undefined =>
  reservedClientIds?.find(
    (clientId) => clientId === input.authClientId || clientId === input.tenantAdminClient?.clientId
  );

const rejectReservedOidcClientId = <TContext>(
  deps: InstanceRegistryHttpDeps<TContext>,
  input: Pick<CreateInstancePayload, 'authClientId' | 'tenantAdminClient'>
): Response | null => {
  const reservedClientIds =
    typeof deps.reservedOidcClientIds === 'function'
      ? deps.reservedOidcClientIds()
      : deps.reservedOidcClientIds;
  const clientId = findReservedOidcClientId(input, reservedClientIds);
  return clientId
    ? deps.createApiError(
        400,
        'oidc_client_id_reserved',
        mutationErrorMessages.oidc_client_id_reserved,
        deps.getRequestId(),
        { clientId }
      )
    : null;
};

export const createCreateInstanceHandler =
  <TContext>(deps: InstanceRegistryHttpDeps<TContext>) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
    const guardError = requireMutationGuards(deps, request, ctx, { requireFreshReauth: false });
    if (guardError) {
      return guardError;
    }

    const idempotencyResult = deps.requireIdempotencyKey(request, deps.getRequestId());
    if ('error' in idempotencyResult) {
      return idempotencyResult.error;
    }

    const payloadResult = await deps.parseRequestBody(request, createInstanceSchema);
    if (!payloadResult.ok) {
      return deps.createApiError(
        400,
        'invalid_request',
        payloadResult.message,
        deps.getRequestId()
      );
    }
    const payload = resolveCreateInstanceDefaults(payloadResult.data);
    const reservedClientError = rejectReservedOidcClientId(deps, payload);
    if (reservedClientError) {
      return reservedClientError;
    }

    const actor = deps.getActor(ctx);
    let result: Awaited<ReturnType<InstanceRegistryService['createProvisioningRequest']>>;
    try {
      const executeCreate = (service: InstanceRegistryService) =>
        service.createProvisioningRequest(
          buildCreateInstanceProvisioningInput(payload, {
            idempotencyKey: idempotencyResult.key,
            actorId: actor.id,
            requestId: deps.getRequestId(),
          })
        );
      result = await deps.withRegistryCreateService(payload.instanceId, executeCreate);
    } catch (error) {
      return deps.mapMutationError(error, {
        operation: 'create_instance',
        requestId: deps.getRequestId(),
        instanceId: payload.instanceId,
      });
    }

    if (!result.ok) {
      return deps.createApiError(
        409,
        'conflict',
        'Instanz-ID ist bereits vergeben.',
        deps.getRequestId()
      );
    }

    deps.onInstanceProvisioningRequested?.({
      instanceId: result.instance.instanceId,
      primaryHostname: buildPrimaryHostname(
        result.instance.instanceId,
        normalizeHost(payloadResult.data.parentDomain)
      ),
      actorId: actor.id,
    });

    return deps.jsonResponse(201, deps.asApiItem(result.instance, deps.getRequestId()));
  };

export const createDraftReadinessHandler =
  <TContext>(deps: InstanceRegistryHttpDeps<TContext>) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
    const guardError = requireMutationGuards(deps, request, ctx, { requireFreshReauth: false });
    if (guardError) return guardError;
    const payloadResult = await deps.parseRequestBody(request, createInstanceSchema);
    if (!payloadResult.ok) {
      return deps.createApiError(
        400,
        'invalid_request',
        payloadResult.message,
        deps.getRequestId()
      );
    }
    const payload = resolveCreateInstanceDefaults(payloadResult.data);
    try {
      const readiness = await deps.withRegistryService((service) =>
        service.getDraftReadiness(
          buildCreateInstanceProvisioningInput(payload, {
            idempotencyKey: 'draft-readiness',
            actorId: deps.getActor(ctx).id,
            requestId: deps.getRequestId(),
          })
        )
      );
      return deps.jsonResponse(200, deps.asApiItem(readiness, deps.getRequestId()));
    } catch (error) {
      return deps.mapMutationError(error, {
        operation: 'get_instance_draft_readiness',
        requestId: deps.getRequestId(),
        instanceId: payload.instanceId,
      });
    }
  };

export const createRetryTenantProvisioningHandler =
  <TContext>(deps: InstanceRegistryHttpDeps<TContext>) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
    const guardError = requireMutationGuards(deps, request, ctx, { requireFreshReauth: false });
    if (guardError) return guardError;

    const idempotencyResult = deps.requireIdempotencyKey(request, deps.getRequestId());
    if ('error' in idempotencyResult) return idempotencyResult.error;

    const instanceId = readInstanceIdOrError(deps, request);
    if (instanceId instanceof Response) return instanceId;

    const actor = deps.getActor(ctx);
    try {
      const retry = (service: InstanceRegistryService) =>
        service.retryTenantProvisioning({
          instanceId,
          actorId: actor.id,
          requestId: deps.getRequestId(),
        });
      const result = await deps.withRegistryCreateService(instanceId, retry);
      if (!result) {
        return deps.createApiError(
          404,
          'not_found',
          'Instanz wurde nicht gefunden.',
          deps.getRequestId()
        );
      }

      deps.onInstanceProvisioningRequested?.({
        instanceId: result.instanceId,
        primaryHostname: result.primaryHostname,
        actorId: actor.id,
      });
      return deps.jsonResponse(200, deps.asApiItem(result, deps.getRequestId()));
    } catch (error) {
      return deps.mapMutationError(error, {
        operation: 'retry_instance_provisioning',
        requestId: deps.getRequestId(),
        instanceId,
      });
    }
  };

export const createUpdateInstanceHandler =
  <TContext>(deps: InstanceRegistryHttpDeps<TContext>) =>
  async (request: Request, ctx: TContext): Promise<Response> => {
    const guardError = requireMutationGuards(deps, request, ctx, { requireFreshReauth: false });
    if (guardError) {
      return guardError;
    }

    const instanceId = readInstanceIdOrError(deps, request);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const payloadResult = await deps.parseRequestBody<UpdateInstancePayload>(
      request,
      updateInstanceSchema
    );
    if (!payloadResult.ok) {
      return deps.createApiError(
        400,
        'invalid_request',
        payloadResult.message,
        deps.getRequestId()
      );
    }
    const reservedClientError = rejectReservedOidcClientId(deps, payloadResult.data);
    if (reservedClientError) {
      return reservedClientError;
    }

    try {
      const update = (service: InstanceRegistryService) =>
        service.updateInstance(
          buildUpdateInstanceInput(instanceId, payloadResult.data, {
            actorId: deps.getActor(ctx).id,
            requestId: deps.getRequestId(),
          })
        );
      const updated = await deps.withScopedRegistryService(instanceId, update);

      if (!updated) {
        return deps.createApiError(
          404,
          'not_found',
          'Instanz wurde nicht gefunden.',
          deps.getRequestId()
        );
      }

      return deps.jsonResponse(200, deps.asApiItem(updated, deps.getRequestId()));
    } catch (error) {
      return deps.mapMutationError(error, {
        operation: 'update_instance',
        requestId: deps.getRequestId(),
        instanceId,
      });
    }
  };
