import type { StudioJobStartRequest } from '@sva/core';

import { completeIdempotency, reserveIdempotency } from '../iam-account-management/shared.js';
import { createApiError, toPayloadHash } from '../shared/request-helpers.js';
import { createJsonItemResponse, createPluginOperationJob, markPluginOperationEnqueueFailed } from './core.shared.js';
import { getRegisteredPluginOperationExecutionRegistry, queuePluginOperationJob } from './runner.js';

export const startPluginOperationEndpoint = 'POST:/api/v1/plugin-operations/jobs';

const readPluginNamespace = (value: string): string | null => {
  const trimmed = value.trim();
  const dotIndex = trimmed.indexOf('.');
  if (dotIndex <= 0) {
    return null;
  }

  return trimmed.slice(0, dotIndex);
};

export const validateStartRequestData = (
  data: StudioJobStartRequest,
  requestId: string | undefined
): Response | null => {
  if (data.pluginId === 'waste-management') {
    return createApiError(
      400,
      'invalid_request',
      'Waste-Management-Jobs dürfen nur über die dedizierten Waste-Endpunkte gestartet werden.',
      requestId
    );
  }

  const jobTypeNamespace = readPluginNamespace(data.jobTypeId);
  if (jobTypeNamespace !== data.pluginId) {
    return createApiError(400, 'invalid_request', 'Jobtyp muss zum angegebenen Plugin-Namespace passen.', requestId);
  }

  if (data.importProfileId) {
    const importProfileNamespace = readPluginNamespace(data.importProfileId);
    if (importProfileNamespace !== data.pluginId) {
      return createApiError(
        400,
        'invalid_request',
        'Importprofil muss zum angegebenen Plugin-Namespace passen.',
        requestId
      );
    }
  }

  if (!getRegisteredPluginOperationExecutionRegistry().has(data.jobTypeId)) {
    return createApiError(400, 'invalid_request', 'Unbekannter Plugin-Jobtyp.', requestId);
  }

  return null;
};

export const reserveStartIdempotency = async (input: {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly idempotencyKey: string;
  readonly rawBody: string;
  readonly requestId?: string;
}): Promise<Response | null> => {
  const reserve = await reserveIdempotency({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    endpoint: startPluginOperationEndpoint,
    idempotencyKey: input.idempotencyKey,
    payloadHash: toPayloadHash(input.rawBody),
  });

  if (reserve.status === 'replay') {
    return new Response(JSON.stringify(reserve.responseBody), {
      status: reserve.responseStatus,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, input.requestId);
  }

  return null;
};

const completeStartIdempotencyResponse = async (
  input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly idempotencyKey: string;
  },
  response: Response
): Promise<Response> => {
  const responseBody = await response.clone().json();
  await completeIdempotency({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    endpoint: startPluginOperationEndpoint,
    idempotencyKey: input.idempotencyKey,
    status: response.status >= 400 ? 'FAILED' : 'COMPLETED',
    responseStatus: response.status,
    responseBody,
  });
  return response;
};

export const executeStartPluginOperationJob = async (input: {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly idempotencyKey: string;
  readonly requestId?: string;
  readonly data: StudioJobStartRequest;
  readonly scheduledAt: string;
}): Promise<Response> => {
  const responseContext = {
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    idempotencyKey: input.idempotencyKey,
  };

  try {
    const registration = getRegisteredPluginOperationExecutionRegistry().get(input.data.jobTypeId);
    if (!registration) {
      return completeStartIdempotencyResponse(
        responseContext,
        createApiError(400, 'invalid_request', 'Unbekannter Plugin-Jobtyp.', input.requestId)
      );
    }

    const job = await createPluginOperationJob({
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
      scheduledAt: input.scheduledAt,
      queueName: registration.queueName,
      data: input.data,
    });

    try {
      await queuePluginOperationJob({
        instanceId: input.instanceId,
        jobId: job.id,
        queueName: job.queueName,
        maxAttempts: job.maxAttempts,
      });
    } catch {
      await markPluginOperationEnqueueFailed({ instanceId: input.instanceId, job });

      return completeStartIdempotencyResponse(
        responseContext,
        createApiError(
          503,
          'database_unavailable',
          'Der Plugin-Job konnte nicht in die Host-Queue gestellt werden.',
          input.requestId
        )
      );
    }

    return completeStartIdempotencyResponse(responseContext, createJsonItemResponse(202, job, input.requestId));
  } catch {
    return completeStartIdempotencyResponse(
      responseContext,
      createApiError(503, 'database_unavailable', 'Der Plugin-Job konnte nicht angelegt werden.', input.requestId)
    );
  }
};
