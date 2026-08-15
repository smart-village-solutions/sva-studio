import { getWorkspaceContext } from '@sva/server-runtime';

import type { QueryClient } from './query-client.js';

export const isDsrLegalHoldActive = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<boolean> => {
  const result = await client.query<{ id: string }>(
    `
SELECT id
FROM iam.legal_holds
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND active = true
  AND (hold_until IS NULL OR hold_until > NOW())
LIMIT 1;
`,
    [input.instanceId, input.accountId]
  );

  return result.rowCount > 0;
};

export const emitDsrAuditEvent = async (
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

export const appendDsrRequestEvent = async (
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
