import { getWorkspaceContext } from '@sva/server-runtime';

import {
  collectDsrExportPayload,
  serializeDsrExportPayload,
  type DsrExportAccountSnapshot,
  type DsrExportFormat,
} from './dsr-export-payload.js';
import type { QueryClient } from './query-client.js';

export type DsrExportRequestInput = {
  instanceId?: string;
  format: DsrExportFormat;
  async: boolean;
};

export type DsrAdminExportRequestInput = DsrExportRequestInput & {
  targetKeycloakSubject: string;
};

export type DsrIdempotencyReservation =
  | { status: 'reserved' }
  | { status: 'replay'; responseStatus: number; responseBody: unknown }
  | { status: 'conflict'; message: string };

export type DsrExportFlowDeps = {
  readonly reserveIdempotency: (input: {
    instanceId: string;
    actorAccountId: string;
    endpoint: string;
    idempotencyKey: string;
    payloadHash: string;
  }) => Promise<DsrIdempotencyReservation>;
  readonly completeIdempotency: (input: {
    instanceId: string;
    actorAccountId: string;
    endpoint: string;
    idempotencyKey: string;
    status: 'COMPLETED';
    responseStatus: number;
    responseBody: unknown;
  }) => Promise<void>;
  readonly toPayloadHash: (body: string) => string;
  readonly jsonResponse: (status: number, body: unknown) => Response;
  readonly textResponse: (status: number, body: string, contentType: string) => Response;
};

type IdempotentTextResponse = {
  kind: 'text';
  body: string;
  contentType: string;
};

const SELF_EXPORT_ENDPOINT = 'POST:/iam/me/data-export';
const ADMIN_EXPORT_ENDPOINT = 'POST:/iam/admin/data-subject-rights/export';

const asIdempotentTextResponse = (body: string, contentType: string): IdempotentTextResponse => ({
  kind: 'text',
  body,
  contentType,
});

const toResponseFromIdempotencyPayload = (
  deps: Pick<DsrExportFlowDeps, 'jsonResponse' | 'textResponse'>,
  status: number,
  payload: unknown
): Response => {
  if (
    payload &&
    typeof payload === 'object' &&
    'kind' in payload &&
    (payload as { kind?: unknown }).kind === 'text'
  ) {
    const typedPayload = payload as { body?: unknown; contentType?: unknown };
    return deps.textResponse(
      status,
      typeof typedPayload.body === 'string' ? typedPayload.body : '',
      typeof typedPayload.contentType === 'string' ? typedPayload.contentType : 'text/plain; charset=utf-8'
    );
  }

  return deps.jsonResponse(status, payload);
};

const resolveAccountBySubject = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<DsrExportAccountSnapshot | undefined> => {
  const query = await client.query<DsrExportAccountSnapshot>(
    `
SELECT
  a.id,
  a.keycloak_subject,
  a.email_ciphertext,
  a.display_name_ciphertext,
  a.is_blocked,
  a.soft_deleted_at,
  a.delete_after,
  a.permanently_deleted_at,
  a.processing_restricted_at,
  a.processing_restriction_reason,
  a.non_essential_processing_opt_out_at,
  a.created_at,
  a.updated_at
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );

  return query.rowCount > 0 ? query.rows[0] : undefined;
};

const createAsyncExportJob = async (
  client: QueryClient,
  input: {
    instanceId: string;
    targetAccountId: string;
    requestedByAccountId: string;
    format: DsrExportFormat;
  }
): Promise<{ id: string; status: string }> => {
  const created = await client.query<{ id: string; status: string }>(
    `
INSERT INTO iam.data_subject_export_jobs (
  instance_id,
  target_account_id,
  requested_by_account_id,
  format,
  status
)
VALUES ($1, $2::uuid, $3::uuid, $4, 'queued')
RETURNING id, status;
`,
    [input.instanceId, input.targetAccountId, input.requestedByAccountId, input.format]
  );

  const job = created.rows[0];
  if (!job) {
    throw new Error('export_job_not_created');
  }
  return job;
};

const createDsrRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    status: 'accepted' | 'completed';
    requesterAccountId: string;
    targetAccountId: string;
    payload: Record<string, unknown>;
    completedAt?: string;
  }
): Promise<string> => {
  const created = await client.query<{ id: string }>(
    `
INSERT INTO iam.data_subject_requests (
  instance_id,
  request_type,
  status,
  requester_account_id,
  target_account_id,
  legal_hold_blocked,
  payload,
  sla_deadline_at,
  completed_at
)
VALUES ($1, 'access', $2, $3::uuid, $4::uuid, false, $5::jsonb, NULL, $6::timestamptz)
RETURNING id;
`,
    [
      input.instanceId,
      input.status,
      input.requesterAccountId,
      input.targetAccountId,
      JSON.stringify(input.payload),
      input.completedAt ?? null,
    ]
  );

  const requestRow = created.rows[0];
  if (!requestRow) {
    throw new Error('dsr_request_not_created');
  }
  return requestRow.id;
};

const appendDsrRequestEvent = async (
  client: QueryClient,
  input: {
    instanceId: string;
    requestId: string;
    actorAccountId?: string;
    eventType: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> => {
  await client.query(
    `
INSERT INTO iam.data_subject_request_events (instance_id, request_id, actor_account_id, event_type, event_payload)
VALUES ($1, $2::uuid, $3::uuid, $4, $5::jsonb);
`,
    [
      input.instanceId,
      input.requestId,
      input.actorAccountId ?? null,
      input.eventType,
      JSON.stringify(input.payload ?? {}),
    ]
  );
};

const emitDsrAuditEvent = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId?: string;
    eventType: string;
    payload: Record<string, unknown>;
  }
): Promise<void> => {
  await client.query(
    `
INSERT INTO iam.activity_logs (instance_id, account_id, event_type, payload, request_id, trace_id)
VALUES ($1, $2::uuid, $3, $4::jsonb, $5, $6);
`,
    [
      input.instanceId,
      input.accountId ?? null,
      input.eventType,
      JSON.stringify(input.payload),
      getWorkspaceContext().requestId ?? null,
      getWorkspaceContext().traceId ?? null,
    ]
  );
};

const completeTextExportIdempotency = (
  deps: DsrExportFlowDeps,
  input: {
    instanceId: string;
    actorAccountId: string;
    endpoint: string;
    idempotencyKey: string;
    responseStatus: number;
    body: string;
    contentType: string;
  }
): Promise<void> =>
  deps.completeIdempotency({
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    endpoint: input.endpoint,
    idempotencyKey: input.idempotencyKey,
    status: 'COMPLETED',
    responseStatus: input.responseStatus,
    responseBody: asIdempotentTextResponse(input.body, input.contentType),
  });

const createSyncExportResponse = async (
  deps: DsrExportFlowDeps,
  input: {
    instanceId: string;
    actorAccountId: string;
    endpoint: string;
    idempotencyKey: string;
    format: DsrExportFormat;
    payload: Awaited<ReturnType<typeof collectDsrExportPayload>>;
  }
): Promise<Response> => {
  if (input.format === 'json') {
    const body = JSON.stringify(input.payload, null, 2);
    await completeTextExportIdempotency(deps, {
      ...input,
      responseStatus: 200,
      body,
      contentType: 'application/json',
    });
    return deps.textResponse(200, body, 'application/json');
  }

  const body = serializeDsrExportPayload(input.format, input.payload);
  const contentType = input.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/xml; charset=utf-8';
  await completeTextExportIdempotency(deps, {
    ...input,
    responseStatus: 200,
    body,
    contentType,
  });
  return deps.textResponse(200, body, contentType);
};

export const createDsrExportFlows = (deps: DsrExportFlowDeps) => ({
  runSelfExport: async (input: {
    client: QueryClient;
    instanceId: string;
    keycloakSubject: string;
    exportRequest: DsrExportRequestInput;
    idempotencyKey: string;
  }): Promise<Response> => {
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
      const job = await createAsyncExportJob(input.client, {
        instanceId: input.instanceId,
        targetAccountId: account.id,
        requestedByAccountId: account.id,
        format: input.exportRequest.format,
      });

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
  },

  runAdminExport: async (input: {
    client: QueryClient;
    instanceId: string;
    actorKeycloakSubject: string;
    exportRequest: DsrAdminExportRequestInput;
    idempotencyKey: string;
  }): Promise<Response> => {
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
      const job = await createAsyncExportJob(input.client, {
        instanceId: input.instanceId,
        targetAccountId: target.id,
        requestedByAccountId: actorAccountId,
        format: input.exportRequest.format,
      });
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

    const payload = await collectDsrExportPayload(input.client, {
      instanceId: input.instanceId,
      account: target,
      format: input.exportRequest.format,
    });

    await emitDsrAuditEvent(input.client, {
      instanceId: input.instanceId,
      accountId: actor?.id,
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
  },
});
