import { resolveGovernanceAccountId } from './governance-audit-shared.js';
import { validateGovernanceTicketState } from './governance-workflow-policy.js';
import {
  emitGovernanceAuditEvent,
  type GovernanceActor,
  type GovernanceWorkflowExecutorDeps,
  type GovernanceWorkflowResponse,
} from './governance-workflow-shared.js';
import { readString } from './input-readers.js';
import type { QueryClient } from './query-client.js';

const resolvePermissionKeyForRole = async (
  client: QueryClient,
  input: { instanceId: string; roleId: string }
): Promise<string[]> => {
  const rows = await client.query<{ permission_key: string }>(
    `
SELECT p.permission_key
FROM iam.role_permissions rp
JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE rp.instance_id = $1
  AND rp.role_id = $2;
`,
    [input.instanceId, input.roleId]
  );

  return rows.rows.map((entry) => entry.permission_key);
};

const isCriticalRoleChange = async (
  client: QueryClient,
  input: { instanceId: string; roleId: string }
): Promise<boolean> => {
  const permissions = await resolvePermissionKeyForRole(client, input);
  return permissions.some((permission) => /(admin|security|iam)/i.test(permission));
};

const insertPermissionChangeRequest = (
  client: QueryClient,
  input: {
    instanceId: string;
    requesterAccountId: string;
    targetAccountId: string;
    roleId: string;
    critical: boolean;
    requestNote: string;
    ticketId: string;
    ticketSystem: string;
    ticketState: string | undefined;
  }
) =>
  client.query<{ id: string }>(
    `
INSERT INTO iam.permission_change_requests (
  instance_id,
  requester_account_id,
  target_account_id,
  role_id,
  status,
  is_critical,
  request_note,
  request_origin,
  ticket_id,
  ticket_system,
  ticket_state
)
VALUES ($1, $2, $3, $4, 'submitted', $5, $6, $7, $8, $9, $10)
RETURNING id;
`,
    [
      input.instanceId,
      input.requesterAccountId,
      input.targetAccountId,
      input.roleId,
      input.critical,
      input.requestNote,
      'admin',
      input.ticketId,
      input.ticketSystem,
      input.ticketState,
    ]
  );

export const submitPermissionChange = async (
  deps: GovernanceWorkflowExecutorDeps,
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const targetSubject = readString(payload.targetKeycloakSubject);
  const roleId = readString(payload.roleId);
  const requestNote = readString(payload.requestNote)?.trim() ?? '';
  const ticketId = readString(payload.ticketId);
  const ticketSystem = readString(payload.ticketSystem) ?? 'jira';
  const ticketState = readString(payload.ticketState);
  if (!targetSubject || !roleId || !deps.isUuid(roleId) || !ticketId) {
    return {
      operation: 'submit_permission_change',
      status: 'error',
      reasonCode: 'invalid_request',
    };
  }

  const ticketValidation = validateGovernanceTicketState(ticketState);
  if (!ticketValidation.ok) {
    return {
      operation: 'submit_permission_change',
      status: 'error',
      reasonCode: ticketValidation.reasonCode,
    };
  }

  const requesterAccountId = await resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });
  const targetAccountId = await resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: targetSubject,
  });

  if (!requesterAccountId || !targetAccountId) {
    return { operation: 'submit_permission_change', status: 'error', reasonCode: 'unauthorized' };
  }

  const critical = await isCriticalRoleChange(client, {
    instanceId: actor.instanceId,
    roleId,
  });

  const insert = await insertPermissionChangeRequest(client, {
    instanceId: actor.instanceId,
    requesterAccountId,
    targetAccountId,
    roleId,
    critical,
    requestNote,
    ticketId,
    ticketSystem,
    ticketState,
  });

  const workflowId = insert.rows[0]?.id;
  if (!workflowId) {
    return {
      operation: 'submit_permission_change',
      status: 'error',
      reasonCode: 'database_unavailable',
    };
  }

  await emitGovernanceAuditEvent(deps, client, {
    instanceId: actor.instanceId,
    actorAccountId: requesterAccountId,
    actorSubject: actor.keycloakSubject,
    targetSubject,
    targetRef: workflowId,
    ticketId,
    eventType: 'governance_permission_change_submitted',
    action: 'permission_change_submit',
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  return { operation: 'submit_permission_change', status: 'ok', workflowId };
};
