import { collectDsrExportPayload, type DsrExportAccountSnapshot } from './dsr-export-payload.js';
import { queueDsrExport } from './dsr-export-flow-queue.js';
import { emitDsrAuditEvent } from './dsr-persistence.js';
import type { QueryClient } from './query-client.js';
import {
  ADMIN_EXPORT_ENDPOINT,
  toResponseFromIdempotencyPayload,
  createSyncExportResponse,
} from './dsr-export-flow-response.js';
import { resolveAccountBySubject } from './dsr-export-flow-persistence.js';
import type { DsrExportFlowDeps, DsrAdminExportRequestInput } from './dsr-export-flow-types.js';

type AdminExportInput = {
  client: QueryClient;
  instanceId: string;
  actorKeycloakSubject: string;
  exportRequest: DsrAdminExportRequestInput;
  idempotencyKey: string;
};

const deliverSyncAdminExport = async (
  deps: DsrExportFlowDeps,
  input: AdminExportInput,
  target: DsrExportAccountSnapshot,
  actorAccountId: string,
  actorAccountIdForAudit: string | undefined
): Promise<Response> => {
  const payload = await collectDsrExportPayload(input.client, {
    instanceId: input.instanceId,
    account: target,
    format: input.exportRequest.format,
  });

  await emitDsrAuditEvent(input.client, {
    instanceId: input.instanceId,
    accountId: actorAccountIdForAudit,
    eventType: 'dsr_admin_export_delivered',
    payload: {
      target_subject: input.exportRequest.targetKeycloakSubject,
      format: input.exportRequest.format,
      mode: 'sync',
      result: 'success',
    },
  });

  return createSyncExportResponse(deps, {
    instanceId: input.instanceId,
    actorAccountId,
    endpoint: ADMIN_EXPORT_ENDPOINT,
    idempotencyKey: input.idempotencyKey,
    format: input.exportRequest.format,
    payload,
  });
};

export const runAdminExport = async (
  deps: DsrExportFlowDeps,
  input: AdminExportInput
): Promise<Response> => {
  const actor = await resolveAccountBySubject(input.client, {
    instanceId: input.instanceId,
    keycloakSubject: input.actorKeycloakSubject,
  });
  const target = await resolveAccountBySubject(input.client, {
    instanceId: input.instanceId,
    keycloakSubject: input.exportRequest.targetKeycloakSubject,
  });
  if (!target) {
    return deps.jsonResponse(404, { error: 'target_account_not_found' });
  }

  const actorAccountId = actor?.id ?? target.id;
  const reserve = await deps.reserveIdempotency({
    instanceId: input.instanceId,
    actorAccountId,
    endpoint: ADMIN_EXPORT_ENDPOINT,
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
      targetAccountId: target.id,
      requestedByAccountId: actorAccountId,
      format: input.exportRequest.format,
    });
    if (!job) {
      return deps.jsonResponse(503, { error: 'export_job_queue_failed' });
    }

    await emitDsrAuditEvent(input.client, {
      instanceId: input.instanceId,
      accountId: actor?.id,
      eventType: 'dsr_admin_export_requested',
      payload: {
        target_subject: input.exportRequest.targetKeycloakSubject,
        export_job_id: job.id,
        format: input.exportRequest.format,
        mode: 'async',
      },
    });
    const responseBody = {
      exportJobId: job.id,
      status: job.status,
      format: input.exportRequest.format,
      target: input.exportRequest.targetKeycloakSubject,
    };
    await deps.completeIdempotency({
      instanceId: input.instanceId,
      actorAccountId,
      endpoint: ADMIN_EXPORT_ENDPOINT,
      idempotencyKey: input.idempotencyKey,
      status: 'COMPLETED',
      responseStatus: 202,
      responseBody,
    });
    return deps.jsonResponse(202, responseBody);
  }

  return deliverSyncAdminExport(deps, input, target, actorAccountId, actor?.id);
};
