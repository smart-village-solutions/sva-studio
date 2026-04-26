import { randomUUID } from 'node:crypto';

import type { IamRoleSyncState } from '@sva/core';

import type { QueryClient } from '../db.js';

import { sanitizeRoleAuditDetails } from './role-audit.js';

export const emitActivityLog = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId?: string;
    subjectId?: string;
    eventType: string;
    result: 'success' | 'failure';
    payload?: Record<string, unknown>;
    requestId?: string;
    traceId?: string;
  }
) => {
  await client.query(
    `
INSERT INTO iam.activity_logs (
  instance_id,
  account_id,
  subject_id,
  event_type,
  result,
  payload,
  request_id,
  trace_id
)
VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7, $8);
`,
    [
      input.instanceId,
      input.accountId ?? null,
      input.subjectId ?? null,
      input.eventType,
      input.result,
      JSON.stringify(input.payload ?? {}),
      input.requestId ?? null,
      input.traceId ?? null,
    ]
  );
};

export const emitRoleAuditEvent = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId?: string;
    roleId?: string;
    eventType: 'role.sync_started' | 'role.sync_succeeded' | 'role.sync_failed' | 'role.reconciled';
    operation: string;
    result: 'success' | 'failure';
    roleKey?: string;
    externalRoleName?: string;
    errorCode?: string;
    details?: Record<string, unknown>;
    requestId?: string;
    traceId?: string;
  }
) => {
  const sanitizedDetails = sanitizeRoleAuditDetails(input.details);
  await emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.accountId,
    eventType: input.eventType,
    result: input.result,
    payload: {
      workspace_id: input.instanceId,
      operation: input.operation,
      result: input.result,
      ...(input.roleId ? { role_id: input.roleId } : {}),
      ...(input.roleKey ? { role_key: input.roleKey } : {}),
      ...(input.externalRoleName ? { external_role_name: input.externalRoleName } : {}),
      ...(input.errorCode ? { error_code: input.errorCode } : {}),
      ...(input.requestId ? { request_id: input.requestId } : {}),
      ...(input.traceId ? { trace_id: input.traceId } : {}),
      ...sanitizedDetails,
    },
    requestId: input.requestId,
    traceId: input.traceId,
  });
};

export const setRoleSyncState = async (
  client: QueryClient,
  input: {
    instanceId: string;
    roleId: string;
    syncState: IamRoleSyncState;
    errorCode?: string | null;
    syncedAt?: boolean;
  }
) => {
  await client.query(
    `
UPDATE iam.roles
SET
  sync_state = $3,
  last_error_code = $4,
  last_synced_at = CASE WHEN $5::boolean THEN NOW() ELSE last_synced_at END,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
    [input.instanceId, input.roleId, input.syncState, input.errorCode ?? null, input.syncedAt ?? false]
  );
};

export const notifyPermissionInvalidation = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject?: string; trigger: string }
) => {
  await client.query('SELECT pg_notify($1, $2);', [
    'iam_permission_snapshot_invalidation',
    JSON.stringify({
      eventId: randomUUID(),
      instanceId: input.instanceId,
      ...(input.keycloakSubject ? { keycloakSubject: input.keycloakSubject } : {}),
      trigger: 'pg_notify',
      reason: input.trigger,
    }),
  ]);
};
