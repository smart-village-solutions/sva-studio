import { resolveGovernanceAccountId } from './governance-audit-shared.js';
import {
  emitGovernanceAuditEvent,
  type GovernanceActor,
  type GovernanceWorkflowExecutorDeps,
  type GovernanceWorkflowResponse,
} from './governance-workflow-shared.js';
import { readString } from './input-readers.js';
import type { QueryClient } from './query-client.js';

const resolvePermissionChangeDecision = (
  approval: string
): Readonly<{
  nextStatus: 'approved' | 'rejected';
  reasonCode: GovernanceWorkflowResponse['reasonCode'];
  result: 'success' | 'failure';
}> => {
  if (approval === 'rejected') {
    return {
      nextStatus: 'rejected',
      reasonCode: 'DENY_POLICY_CONFLICT_RESTRICTIVE_WINS',
      result: 'failure',
    };
  }

  return {
    nextStatus: 'approved',
    reasonCode: undefined,
    result: 'success',
  };
};

const persistPermissionChangeDecision = (
  client: QueryClient,
  input: {
    requestId: string;
    instanceId: string;
    nextStatus: 'approved' | 'rejected';
    approverAccountId: string;
    reason: string | undefined;
  }
) =>
  client.query(
    `
UPDATE iam.permission_change_requests
SET
  status = $3,
  approver_account_id = $4,
  approved_at = CASE WHEN $3 = 'approved' THEN now() ELSE approved_at END,
  rejection_reason = CASE WHEN $3 = 'rejected' THEN $5 ELSE NULL END,
  reason_code = CASE WHEN $3 = 'rejected' THEN 'DENY_POLICY_CONFLICT_RESTRICTIVE_WINS' ELSE NULL END,
  updated_at = now()
WHERE id = $1
  AND instance_id = $2;
`,
    [
      input.requestId,
      input.instanceId,
      input.nextStatus,
      input.approverAccountId,
      input.reason ?? null,
    ]
  );

export const approvePermissionChange = async (
  deps: GovernanceWorkflowExecutorDeps,
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const requestId = readString(payload.requestId);
  const approval = readString(payload.approval) ?? 'approved';
  if (!requestId || !deps.isUuid(requestId)) {
    return {
      operation: 'approve_permission_change',
      status: 'error',
      reasonCode: 'invalid_request',
    };
  }

  const approverAccountId = await resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });
  if (!approverAccountId) {
    return { operation: 'approve_permission_change', status: 'error', reasonCode: 'unauthorized' };
  }

  const row = await client.query<{
    requester_account_id: string;
    is_critical: boolean;
    status: string;
  }>(
    `
SELECT requester_account_id, is_critical, status
FROM iam.permission_change_requests
WHERE id = $1
  AND instance_id = $2
LIMIT 1;
`,
    [requestId, actor.instanceId]
  );
  if (row.rowCount <= 0) {
    return {
      operation: 'approve_permission_change',
      status: 'error',
      reasonCode: 'invalid_request',
    };
  }

  const request = row.rows[0];
  if (!request) {
    return {
      operation: 'approve_permission_change',
      status: 'error',
      reasonCode: 'invalid_request',
    };
  }
  if (request.requester_account_id === approverAccountId) {
    return {
      operation: 'approve_permission_change',
      status: 'error',
      reasonCode: 'DENY_SELF_APPROVAL',
    };
  }
  if (request.status !== 'submitted') {
    return {
      operation: 'approve_permission_change',
      status: 'error',
      reasonCode: 'invalid_request',
    };
  }

  const decision = resolvePermissionChangeDecision(approval);
  await persistPermissionChangeDecision(client, {
    requestId,
    instanceId: actor.instanceId,
    nextStatus: decision.nextStatus,
    approverAccountId,
    reason: readString(payload.reason),
  });

  await emitGovernanceAuditEvent(deps, client, {
    instanceId: actor.instanceId,
    actorAccountId: approverAccountId,
    actorSubject: actor.keycloakSubject,
    targetRef: requestId,
    eventType: `governance_permission_change_${decision.nextStatus}`,
    action: `permission_change_${decision.nextStatus}`,
    result: decision.result,
    reasonCode: decision.reasonCode,
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  return { operation: 'approve_permission_change', status: 'ok', workflowId: requestId };
};

export const applyPermissionChange = async (
  deps: GovernanceWorkflowExecutorDeps,
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const requestId = readString(payload.requestId);
  if (!requestId || !deps.isUuid(requestId)) {
    return { operation: 'apply_permission_change', status: 'error', reasonCode: 'invalid_request' };
  }

  const changeLookup = await client.query<{
    target_account_id: string;
    role_id: string;
    status: string;
  }>(
    `
SELECT target_account_id, role_id, status
FROM iam.permission_change_requests
WHERE id = $1
  AND instance_id = $2
LIMIT 1;
`,
    [requestId, actor.instanceId]
  );
  if (changeLookup.rowCount <= 0) {
    return { operation: 'apply_permission_change', status: 'error', reasonCode: 'invalid_request' };
  }
  const change = changeLookup.rows[0];
  if (!change || change.status !== 'approved') {
    return { operation: 'apply_permission_change', status: 'error', reasonCode: 'invalid_request' };
  }

  await client.query(
    `
INSERT INTO iam.account_roles (instance_id, account_id, role_id)
VALUES ($1, $2, $3)
ON CONFLICT DO NOTHING;
`,
    [actor.instanceId, change.target_account_id, change.role_id]
  );

  await client.query(
    `
UPDATE iam.permission_change_requests
SET status = 'applied', applied_at = now(), updated_at = now()
WHERE id = $1
  AND instance_id = $2;
`,
    [requestId, actor.instanceId]
  );

  const actorAccountId = await resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });

  await emitGovernanceAuditEvent(deps, client, {
    instanceId: actor.instanceId,
    actorAccountId,
    actorSubject: actor.keycloakSubject,
    targetRef: requestId,
    eventType: 'governance_permission_change_applied',
    action: 'permission_change_applied',
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  return { operation: 'apply_permission_change', status: 'ok', workflowId: requestId };
};
