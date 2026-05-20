import { randomUUID } from 'node:crypto';

import {
  pseudonymizeGovernanceSubject,
  resolveGovernanceAccountId,
} from './governance-audit-shared.js';
import type { QueryClient } from './query-client.js';

export const MAX_SELF_SERVICE_PERMISSION_CHANGE_REQUEST_NOTE_LENGTH = 2000;

export const createSelfServicePermissionChangeRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    actorKeycloakSubject: string;
    requestNote: string;
    requestId?: string;
    traceId?: string;
  }
): Promise<{ workflowId: string; actorAccountId: string } | null> => {
  const actorAccountId = await resolveGovernanceAccountId(client, {
    instanceId: input.instanceId,
    keycloakSubject: input.actorKeycloakSubject,
  });

  if (!actorAccountId) {
    return null;
  }

  const inserted = await client.query<{ id: string }>(
    `
INSERT INTO iam.permission_change_requests (
  instance_id,
  requester_account_id,
  target_account_id,
  role_id,
  status,
  is_critical,
  request_note,
  request_origin
)
VALUES ($1, $2, $2, NULL, 'intake', false, $3, 'self_service')
RETURNING id;
`,
    [input.instanceId, actorAccountId, input.requestNote]
  );

  const workflowId = inserted.rows[0]?.id;
  if (!workflowId) {
    return null;
  }

  const payload = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    instance_id: input.instanceId,
    action: 'permission_change_request',
    result: 'success',
    actor_pseudonym: pseudonymizeGovernanceSubject(input.actorKeycloakSubject),
    target_ref: workflowId,
    reason_code: 'self_service_request',
    request_id: input.requestId,
    trace_id: input.traceId,
    request_origin: 'self_service',
  };

  await client.query(
    `
INSERT INTO iam.activity_logs (
  instance_id,
  account_id,
  event_type,
  payload,
  request_id,
  trace_id
)
VALUES ($1, $2, $3, $4::jsonb, $5, $6);
`,
    [
      input.instanceId,
      actorAccountId,
      'governance_permission_change_requested',
      JSON.stringify(payload),
      input.requestId ?? null,
      input.traceId ?? null,
    ]
  );

  return {
    workflowId,
    actorAccountId,
  };
};
