import { collectDsrExportPayload, type DsrExportAccountSnapshot } from './dsr-export-payload.js';
import { queueDsrExport } from './dsr-export-flow-queue.js';
import { appendDsrRequestEvent, emitDsrAuditEvent } from './dsr-persistence.js';
import type { QueryClient } from './query-client.js';
import {
  SELF_EXPORT_ENDPOINT,
  toResponseFromIdempotencyPayload,
  createSyncExportResponse,
} from './dsr-export-flow-response.js';
import { resolveAccountBySubject, createDsrRequest } from './dsr-export-flow-persistence.js';
import type { DsrExportFlowDeps, DsrExportRequestInput } from './dsr-export-flow-types.js';

type SelfExportInput = {
  client: QueryClient;
  instanceId: string;
  keycloakSubject: string;
  exportRequest: DsrExportRequestInput;
  idempotencyKey: string;
};

const deliverSyncSelfExport = async (
  deps: DsrExportFlowDeps,
  input: SelfExportInput,
  account: DsrExportAccountSnapshot
): Promise<Response> => {
  const payload = await collectDsrExportPayload(input.client, {
    instanceId: input.instanceId,
    account,
    format: input.exportRequest.format,
  });

  const requestId = await createDsrRequest(input.client, {
    instanceId: input.instanceId,
    status: 'completed',
    requesterAccountId: account.id,
    targetAccountId: account.id,
    payload: { format: input.exportRequest.format, mode: 'sync' },
    completedAt: new Date().toISOString(),
  });

  await appendDsrRequestEvent(input.client, {
    instanceId: input.instanceId,
    requestId,
    actorAccountId: account.id,
    eventType: 'export_delivered',
    payload: { format: input.exportRequest.format, mode: 'sync' },
  });

  await emitDsrAuditEvent(input.client, {
    instanceId: input.instanceId,
    accountId: account.id,
    eventType: 'dsr_export_delivered',
    payload: {
      request_id: requestId,
      format: input.exportRequest.format,
      mode: 'sync',
      result: 'success',
    },
  });

  return createSyncExportResponse(deps, {
    instanceId: input.instanceId,
    actorAccountId: account.id,
    endpoint: SELF_EXPORT_ENDPOINT,
    idempotencyKey: input.idempotencyKey,
    format: input.exportRequest.format,
    payload,
  });
};

export const runSelfExport = async (
  deps: DsrExportFlowDeps,
  input: SelfExportInput
): Promise<Response> => {
  const account = await resolveAccountBySubject(input.client, {
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
  });
  if (!account) {
    return deps.jsonResponse(404, { error: 'account_not_found' });
  }

  const reserve = await deps.reserveIdempotency({
    instanceId: input.instanceId,
    actorAccountId: account.id,
    endpoint: SELF_EXPORT_ENDPOINT,
    idempotencyKey: input.idempotencyKey,
    payloadHash: deps.toPayloadHash(JSON.stringify(input.exportRequest)),
  });
  if (reserve.status === 'replay') {
    return toResponseFromIdempotencyPayload(deps, reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return deps.jsonResponse(409, { error: 'idempotency_key_reuse', message: reserve.message });
  }

  if (input.exportRequest.async) {
    const job = await queueDsrExport(deps, input.client, {
      instanceId: input.instanceId,
      targetAccountId: account.id,
      requestedByAccountId: account.id,
      format: input.exportRequest.format,
    });
    if (!job) {
      return deps.jsonResponse(503, { error: 'export_job_queue_failed' });
    }

    const requestId = await createDsrRequest(input.client, {
      instanceId: input.instanceId,
      status: 'accepted',
      requesterAccountId: account.id,
      targetAccountId: account.id,
      payload: { format: input.exportRequest.format, mode: 'async', exportJobId: job.id },
    });

    await appendDsrRequestEvent(input.client, {
      instanceId: input.instanceId,
      requestId,
      actorAccountId: account.id,
      eventType: 'export_job_queued',
      payload: { exportJobId: job.id, format: input.exportRequest.format },
    });

    await emitDsrAuditEvent(input.client, {
      instanceId: input.instanceId,
      accountId: account.id,
      eventType: 'dsr_export_requested',
      payload: {
        request_id: requestId,
        export_job_id: job.id,
        format: input.exportRequest.format,
        mode: 'async',
      },
    });

    const responseBody = {
      exportJobId: job.id,
      status: job.status,
      format: input.exportRequest.format,
    };
    await deps.completeIdempotency({
      instanceId: input.instanceId,
      actorAccountId: account.id,
      endpoint: SELF_EXPORT_ENDPOINT,
      idempotencyKey: input.idempotencyKey,
      status: 'COMPLETED',
      responseStatus: 202,
      responseBody,
    });
    return deps.jsonResponse(202, responseBody);
  }

  return deliverSyncSelfExport(deps, input, account);
};
