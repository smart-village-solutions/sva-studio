import { wasteManagementOperationsContract, type StudioJobStartRequest } from '@sva/core';

import { completeIdempotency, reserveIdempotency } from '../../iam-account-management/shared.js';
import {
  createJsonItemResponse,
  createPluginOperationJob,
  markPluginOperationEnqueueFailed,
} from '../../plugin-operations/core.shared.js';
import { queuePluginOperationJob } from '../../plugin-operations/runner.js';
import { createApiError, toPayloadHash } from '../../shared/request-helpers.js';

export const startPluginOperationJobFromFacade = async (input: {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly endpoint: string;
  readonly idempotencyKey: string;
  readonly requestId?: string;
  readonly scheduledAt: string;
  readonly data: StudioJobStartRequest;
}): Promise<Response> => {
  const reserved = await reserveIdempotency({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    endpoint: input.endpoint,
    idempotencyKey: input.idempotencyKey,
    payloadHash: toPayloadHash(JSON.stringify(input.data)),
  });

  if (reserved.status === 'replay') {
    return new Response(JSON.stringify(reserved.responseBody), {
      status: reserved.responseStatus,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (reserved.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserved.message, input.requestId);
  }

  const complete = async (response: Response): Promise<Response> => {
    const responseBody = await response.clone().json();
    await completeIdempotency({
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      endpoint: input.endpoint,
      idempotencyKey: input.idempotencyKey,
      status: response.status >= 400 ? 'FAILED' : 'COMPLETED',
      responseStatus: response.status,
      responseBody,
    });
    return response;
  };

  try {
    const job = await createPluginOperationJob({
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
      scheduledAt: input.scheduledAt,
      queueName: wasteManagementOperationsContract.queueName,
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
      return complete(
        createApiError(
          503,
          'database_unavailable',
          'Der Waste-Job konnte nicht in die Host-Queue gestellt werden.',
          input.requestId
        )
      );
    }

    return complete(createJsonItemResponse(202, job, input.requestId));
  } catch {
    return complete(
      createApiError(503, 'database_unavailable', 'Der Waste-Job konnte nicht angelegt werden.', input.requestId)
    );
  }
};
