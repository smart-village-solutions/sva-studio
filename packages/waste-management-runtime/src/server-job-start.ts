import { type StudioJobStartRequest } from '@sva/core';
import { wasteManagementOperationsContract } from '@sva/waste-management-contracts';

import type { StudioJobRecord } from '@sva/core';
import type { WasteManagementHandlerDeps } from './handlers/types.js';

type RequiredDependency<K extends keyof WasteManagementHandlerDeps> = NonNullable<
  WasteManagementHandlerDeps[K]
>;

type StartInput = Parameters<RequiredDependency<'startPluginOperationJob'>>[0];

export type WasteJobHost = Readonly<{
  reserveIdempotency: (
    input: Omit<Parameters<RequiredDependency<'reserveIdempotency'>>[0], 'inProgressLeaseMs'>
  ) => ReturnType<RequiredDependency<'reserveIdempotency'>>;
  completeIdempotency: (
    input: Omit<Parameters<RequiredDependency<'completeIdempotency'>>[0], 'leaseToken'>
  ) => Promise<boolean | void>;
  createPluginOperationJob: (input: {
    instanceId: string;
    actorAccountId: string;
    idempotencyKey: string;
    requestId?: string;
    scheduledAt: string;
    queueName: string;
    data: StudioJobStartRequest;
  }) => Promise<StudioJobRecord>;
  markPluginOperationEnqueueFailed: (input: {
    instanceId: string;
    job: StudioJobRecord;
  }) => Promise<void>;
  queuePluginOperationJob: (input: {
    instanceId: string;
    jobId: string;
    queueName: string;
    maxAttempts: number;
    executionLane: 'privileged' | 'default';
  }) => Promise<void>;
  createJsonItemResponse: (status: number, item: unknown, requestId?: string) => Response;
  createApiError: (
    status: number,
    code: 'active_job_exists' | 'database_unavailable' | 'idempotency_key_reuse',
    message: string,
    requestId?: string
  ) => Response;
  toPayloadHash: (payload: string) => string;
}>;

const isActivePostalCodeJobConflict = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === '23505' &&
  'constraint' in error &&
  error.constraint === 'idx_studio_jobs_active_waste_postal_code_enrichment';

const createJobCreationError = (
  host: WasteJobHost,
  error: unknown,
  rejectWhenActiveJobExists: boolean | undefined,
  requestId: string | undefined
): Response => {
  if (rejectWhenActiveJobExists === true && isActivePostalCodeJobConflict(error)) {
    return host.createApiError(
      409,
      'active_job_exists',
      'Für diese Instanz läuft bereits eine Postleitzahl-Anreicherung.',
      requestId
    );
  }
  return host.createApiError(
    503,
    'database_unavailable',
    'Der Waste-Job konnte nicht angelegt werden.',
    requestId
  );
};

const completeJob = async (
  host: WasteJobHost,
  input: StartInput,
  response: Response
): Promise<Response> => {
  const responseBody = await response.clone().json();
  await host.completeIdempotency({
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

export const createWasteJobStarter = (host: WasteJobHost) => {
  const startPluginOperationJobFromFacade = async (input: StartInput): Promise<Response> => {
    const reserved = await host.reserveIdempotency({
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      endpoint: input.endpoint,
      idempotencyKey: input.idempotencyKey,
      payloadHash: host.toPayloadHash(JSON.stringify(input.data)),
    });

    if (reserved.status === 'replay') {
      return new Response(JSON.stringify(reserved.responseBody), {
        status: reserved.responseStatus,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (reserved.status === 'conflict') {
      return host.createApiError(409, 'idempotency_key_reuse', reserved.message, input.requestId);
    }

    try {
      const isPrivilegedProvisioningJob =
        input.data.jobTypeId ===
        wasteManagementOperationsContract.jobTypeIds.provisionTenantDatabase;
      const job = await host.createPluginOperationJob({
        instanceId: input.instanceId,
        actorAccountId: input.actorAccountId,
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId,
        scheduledAt: input.scheduledAt,
        queueName: isPrivilegedProvisioningJob
          ? wasteManagementOperationsContract.provisioningQueueName
          : wasteManagementOperationsContract.queueName,
        data: input.data,
      });

      try {
        await host.queuePluginOperationJob({
          instanceId: input.instanceId,
          jobId: job.id,
          queueName: job.queueName,
          maxAttempts: job.maxAttempts,
          executionLane: isPrivilegedProvisioningJob ? 'privileged' : 'default',
        });
      } catch {
        await host.markPluginOperationEnqueueFailed({ instanceId: input.instanceId, job });
        return completeJob(
          host,
          input,
          host.createApiError(
            503,
            'database_unavailable',
            'Der Waste-Job konnte nicht in die Host-Queue gestellt werden.',
            input.requestId
          )
        );
      }

      return completeJob(host, input, host.createJsonItemResponse(202, job, input.requestId));
    } catch (error) {
      return completeJob(
        host,
        input,
        createJobCreationError(host, error, input.rejectWhenActiveJobExists, input.requestId)
      );
    }
  };

  return startPluginOperationJobFromFacade;
};
