import { createHash, randomUUID } from 'node:crypto';
import { createSdkLogger, getWorkspaceContext, withRequestContext } from '@sva/sdk/server';

import { withAuthenticatedUser } from '../middleware.server';
import { createPoolResolver, jsonResponse, type QueryClient, withInstanceDb } from '../shared/db-helpers';
import { isUuid, readNumber, readString } from '../shared/input-readers';
import { buildLogContext } from '../shared/log-context';
import { governanceRequestSchema, type GovernanceRequestInput } from '../shared/schemas';

const logger = createSdkLogger({ component: 'iam-governance', level: 'info' });

const MAX_IMPERSONATION_MINUTES = 120;
const MAX_DELEGATION_DAYS = 30;
const ALLOWED_TICKET_STATES = new Set(['open', 'in_progress', 'approved_for_execution']);
const GOVERNANCE_WORKFLOW_ROLES = new Set(['iam_admin', 'support_admin', 'system_admin']);
const GOVERNANCE_COMPLIANCE_EXPORT_ROLES = new Set([
  'iam_admin',
  'system_admin',
  'security_admin',
  'compliance_officer',
]);

type GovernanceOperation =
  | 'submit_permission_change'
  | 'approve_permission_change'
  | 'apply_permission_change'
  | 'create_delegation'
  | 'revoke_delegation'
  | 'start_impersonation'
  | 'end_impersonation'
  | 'accept_legal_text'
  | 'revoke_legal_acceptance';

type GovernanceWorkflowRequest = GovernanceRequestInput;

type GovernanceWorkflowResponse = {
  operation: GovernanceOperation;
  status: 'ok' | 'error';
  workflowId?: string;
  reasonCode?: string;
  message?: string;
};

type GovernanceActor = {
  keycloakSubject: string;
  instanceId: string;
  roles: readonly string[];
  requestId?: string;
  traceId?: string;
};

const resolvePool = createPoolResolver(() => process.env.IAM_DATABASE_URL);

const pseudonymize = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 16);
const buildGovernanceLogContext = (instanceId?: string) =>
  buildLogContext(instanceId, { includeTraceId: true });

const parseWorkflowRequest = async (request: Request): Promise<GovernanceWorkflowRequest | null> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }

  const parsed = governanceRequestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
};

const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withInstanceDb(resolvePool, instanceId, work);

const resolveAccountId = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<string | undefined> => {
  const lookup = await client.query<{ id: string }>(
    `
SELECT a.id
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );
  if (lookup.rowCount <= 0) {
    return undefined;
  }
  return lookup.rows[0]?.id;
};

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

const validateTicketState = (ticketState: string | undefined): { ok: boolean; reasonCode?: string } => {
  if (!ticketState) {
    return { ok: false, reasonCode: 'DENY_TICKET_REQUIRED' };
  }
  if (!ALLOWED_TICKET_STATES.has(ticketState)) {
    return { ok: false, reasonCode: 'DENY_TICKET_STATE_INVALID' };
  }
  return { ok: true };
};

const hasRequiredRole = (userRoles: readonly string[], allowedRoles: ReadonlySet<string>): boolean =>
  userRoles.some((role) => allowedRoles.has(role));

const requiresPrivilegedWorkflowRole = (operation: GovernanceOperation): boolean => {
  if (operation === 'accept_legal_text' || operation === 'revoke_legal_acceptance') {
    return false;
  }
  return true;
};

const emitGovernanceAuditEvent = async (
  client: QueryClient,
  input: {
    instanceId: string;
    actorAccountId?: string;
    eventType: string;
    action: string;
    result: 'success' | 'failure';
    targetRef?: string;
    reasonCode?: string;
    requestId?: string;
    traceId?: string;
    actorSubject?: string;
    targetSubject?: string;
    ticketId?: string;
    durationSeconds?: number;
  }
): Promise<void> => {
  const payload = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    instance_id: input.instanceId,
    action: input.action,
    result: input.result,
    actor_pseudonym: input.actorSubject ? pseudonymize(input.actorSubject) : undefined,
    target_ref: input.targetRef,
    target_pseudonym: input.targetSubject ? pseudonymize(input.targetSubject) : undefined,
    reason_code: input.reasonCode,
    request_id: input.requestId,
    trace_id: input.traceId,
    ticket_id: input.ticketId,
    duration_s: input.durationSeconds,
  };

  logger[input.result === 'success' ? 'info' : 'warn']('Governance audit event emitted', {
    operation: input.action,
    event_type: input.eventType,
    result: input.result,
    actor_pseudonym: payload.actor_pseudonym,
    target_pseudonym: payload.target_pseudonym,
    ticket_id: input.ticketId,
    duration_s: input.durationSeconds,
    reason_code: input.reasonCode,
    sink: 'otel',
    ...buildGovernanceLogContext(input.instanceId),
  });

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
      input.actorAccountId ?? null,
      input.eventType,
      JSON.stringify(payload),
      input.requestId ?? null,
      input.traceId ?? null,
    ]
  );
};

const submitPermissionChange = async (
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const targetSubject = readString(payload.targetKeycloakSubject);
  const roleId = readString(payload.roleId);
  const ticketId = readString(payload.ticketId);
  const ticketSystem = readString(payload.ticketSystem) ?? 'jira';
  const ticketState = readString(payload.ticketState);
  if (!targetSubject || !roleId || !isUuid(roleId) || !ticketId) {
    return { operation: 'submit_permission_change', status: 'error', reasonCode: 'invalid_request' };
  }

  const ticketValidation = validateTicketState(ticketState);
  if (!ticketValidation.ok) {
    return {
      operation: 'submit_permission_change',
      status: 'error',
      reasonCode: ticketValidation.reasonCode,
    };
  }

  const requesterAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });
  const targetAccountId = await resolveAccountId(client, {
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

  const insert = await client.query<{ id: string }>(
    `
INSERT INTO iam.permission_change_requests (
  instance_id,
  requester_account_id,
  target_account_id,
  role_id,
  status,
  is_critical,
  ticket_id,
  ticket_system,
  ticket_state
)
VALUES ($1, $2, $3, $4, 'submitted', $5, $6, $7, $8)
RETURNING id;
`,
    [
      actor.instanceId,
      requesterAccountId,
      targetAccountId,
      roleId,
      critical,
      ticketId,
      ticketSystem,
      ticketState,
    ]
  );

  const workflowId = insert.rows[0]?.id;
  if (!workflowId) {
    return { operation: 'submit_permission_change', status: 'error', reasonCode: 'database_unavailable' };
  }

  await emitGovernanceAuditEvent(client, {
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

const approvePermissionChange = async (
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const requestId = readString(payload.requestId);
  const approval = readString(payload.approval) ?? 'approved';
  if (!requestId || !isUuid(requestId)) {
    return { operation: 'approve_permission_change', status: 'error', reasonCode: 'invalid_request' };
  }

  const approverAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });
  if (!approverAccountId) {
    return { operation: 'approve_permission_change', status: 'error', reasonCode: 'unauthorized' };
  }

  const row = await client.query<{ requester_account_id: string; is_critical: boolean; status: string }>(
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
    return { operation: 'approve_permission_change', status: 'error', reasonCode: 'invalid_request' };
  }

  const request = row.rows[0];
  if (!request) {
    return { operation: 'approve_permission_change', status: 'error', reasonCode: 'invalid_request' };
  }
  if (request.requester_account_id === approverAccountId) {
    return { operation: 'approve_permission_change', status: 'error', reasonCode: 'DENY_SELF_APPROVAL' };
  }
  if (request.status !== 'submitted') {
    return { operation: 'approve_permission_change', status: 'error', reasonCode: 'invalid_request' };
  }

  const nextStatus = approval === 'rejected' ? 'rejected' : 'approved';
  await client.query(
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
    [requestId, actor.instanceId, nextStatus, approverAccountId, readString(payload.reason) ?? null]
  );

  await emitGovernanceAuditEvent(client, {
    instanceId: actor.instanceId,
    actorAccountId: approverAccountId,
    actorSubject: actor.keycloakSubject,
    targetRef: requestId,
    eventType: `governance_permission_change_${nextStatus}`,
    action: `permission_change_${nextStatus}`,
    result: nextStatus === 'approved' ? 'success' : 'failure',
    reasonCode: nextStatus === 'approved' ? undefined : 'DENY_POLICY_CONFLICT_RESTRICTIVE_WINS',
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  return { operation: 'approve_permission_change', status: 'ok', workflowId: requestId };
};

const applyPermissionChange = async (
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const requestId = readString(payload.requestId);
  if (!requestId || !isUuid(requestId)) {
    return { operation: 'apply_permission_change', status: 'error', reasonCode: 'invalid_request' };
  }

  const changeLookup = await client.query<{ target_account_id: string; role_id: string; status: string }>(
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

  const actorAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });

  await emitGovernanceAuditEvent(client, {
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

const createDelegation = async (
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const delegatorSubject = readString(payload.delegatorKeycloakSubject) ?? actor.keycloakSubject;
  const delegateeSubject = readString(payload.delegateeKeycloakSubject);
  const roleId = readString(payload.roleId);
  const approverSubject = readString(payload.approverKeycloakSubject);
  const ticketId = readString(payload.ticketId);
  const ticketState = readString(payload.ticketState);
  const startsAt = readString(payload.startsAt);
  const endsAt = readString(payload.endsAt);

  if (!delegateeSubject || !roleId || !isUuid(roleId) || !approverSubject || !startsAt || !endsAt || !ticketId) {
    return { operation: 'create_delegation', status: 'error', reasonCode: 'invalid_request' };
  }

  const ticketValidation = validateTicketState(ticketState);
  if (!ticketValidation.ok) {
    return { operation: 'create_delegation', status: 'error', reasonCode: ticketValidation.reasonCode };
  }

  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return { operation: 'create_delegation', status: 'error', reasonCode: 'invalid_request' };
  }
  const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (durationDays <= 0 || durationDays > MAX_DELEGATION_DAYS) {
    return { operation: 'create_delegation', status: 'error', reasonCode: 'DENY_DELEGATION_DURATION_EXCEEDED' };
  }

  const delegatorAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: delegatorSubject,
  });
  const delegateeAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: delegateeSubject,
  });
  const approverAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: approverSubject,
  });
  if (!delegatorAccountId || !delegateeAccountId || !approverAccountId) {
    return { operation: 'create_delegation', status: 'error', reasonCode: 'unauthorized' };
  }
  if (delegatorAccountId === approverAccountId) {
    return { operation: 'create_delegation', status: 'error', reasonCode: 'DENY_SELF_APPROVAL' };
  }

  const status = startDate.getTime() <= Date.now() ? 'active' : 'requested';
  const inserted = await client.query<{ id: string }>(
    `
INSERT INTO iam.delegations (
  instance_id,
  delegator_account_id,
  delegatee_account_id,
  role_id,
  status,
  approver_account_id,
  ticket_id,
  ticket_system,
  ticket_state,
  starts_at,
  ends_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, 'jira', $8, $9, $10)
RETURNING id;
`,
    [
      actor.instanceId,
      delegatorAccountId,
      delegateeAccountId,
      roleId,
      status,
      approverAccountId,
      ticketId,
      ticketState,
      startDate.toISOString(),
      endDate.toISOString(),
    ]
  );
  const workflowId = inserted.rows[0]?.id;
  if (!workflowId) {
    return { operation: 'create_delegation', status: 'error', reasonCode: 'database_unavailable' };
  }

  await emitGovernanceAuditEvent(client, {
    instanceId: actor.instanceId,
    actorAccountId: delegatorAccountId,
    actorSubject: delegatorSubject,
    targetSubject: delegateeSubject,
    targetRef: workflowId,
    ticketId,
    eventType: status === 'active' ? 'governance_delegation_created' : 'governance_delegation_requested',
    action: status === 'active' ? 'delegation_create' : 'delegation_request',
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  logger.warn('Delegation workflow event', {
    operation: status === 'active' ? 'delegation_create' : 'delegation_request',
    delegation_id: workflowId,
    actor_pseudonym: pseudonymize(delegatorSubject),
    target_pseudonym: pseudonymize(delegateeSubject),
    ...buildGovernanceLogContext(actor.instanceId),
  });

  return { operation: 'create_delegation', status: 'ok', workflowId };
};

const revokeDelegation = async (
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const delegationId = readString(payload.delegationId);
  if (!delegationId || !isUuid(delegationId)) {
    return { operation: 'revoke_delegation', status: 'error', reasonCode: 'invalid_request' };
  }

  const actorAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });

  await client.query(
    `
UPDATE iam.delegations
SET status = 'revoked', revoked_at = now(), updated_at = now()
WHERE id = $1
  AND instance_id = $2
  AND status IN ('requested', 'active');
`,
    [delegationId, actor.instanceId]
  );

  await emitGovernanceAuditEvent(client, {
    instanceId: actor.instanceId,
    actorAccountId,
    actorSubject: actor.keycloakSubject,
    targetRef: delegationId,
    eventType: 'governance_delegation_revoked',
    action: 'delegation_revoke',
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  return { operation: 'revoke_delegation', status: 'ok', workflowId: delegationId };
};

const startImpersonation = async (
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const targetSubject = readString(payload.targetKeycloakSubject);
  const approverSubject = readString(payload.approverKeycloakSubject);
  const securityApproverSubject = readString(payload.securityApproverKeycloakSubject);
  const ticketId = readString(payload.ticketId);
  const ticketState = readString(payload.ticketState);
  const durationMinutes = readNumber(payload.durationMinutes) ?? MAX_IMPERSONATION_MINUTES;

  if (!targetSubject || !approverSubject || !ticketId) {
    return { operation: 'start_impersonation', status: 'error', reasonCode: 'invalid_request' };
  }

  const ticketValidation = validateTicketState(ticketState);
  if (!ticketValidation.ok) {
    return { operation: 'start_impersonation', status: 'error', reasonCode: ticketValidation.reasonCode };
  }

  if (durationMinutes <= 0 || durationMinutes > MAX_IMPERSONATION_MINUTES) {
    return {
      operation: 'start_impersonation',
      status: 'error',
      reasonCode: 'DENY_IMPERSONATION_DURATION_EXCEEDED',
    };
  }

  const actorAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });
  const targetAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: targetSubject,
  });
  const approverAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: approverSubject,
  });
  if (!actorAccountId || !targetAccountId || !approverAccountId) {
    return { operation: 'start_impersonation', status: 'error', reasonCode: 'unauthorized' };
  }
  if (actorAccountId === approverAccountId) {
    return { operation: 'start_impersonation', status: 'error', reasonCode: 'DENY_SELF_APPROVAL' };
  }

  let securityApproverAccountId: string | undefined;
  if (actor.roles.includes('support_admin')) {
    if (!securityApproverSubject) {
      return { operation: 'start_impersonation', status: 'error', reasonCode: 'DENY_SELF_APPROVAL' };
    }
    securityApproverAccountId = await resolveAccountId(client, {
      instanceId: actor.instanceId,
      keycloakSubject: securityApproverSubject,
    });
    if (!securityApproverAccountId || securityApproverAccountId === actorAccountId) {
      return { operation: 'start_impersonation', status: 'error', reasonCode: 'DENY_SELF_APPROVAL' };
    }
  }

  const insert = await client.query<{ id: string }>(
    `
INSERT INTO iam.impersonation_sessions (
  instance_id,
  actor_account_id,
  target_account_id,
  status,
  ticket_id,
  ticket_system,
  ticket_state,
  approved_by_account_id,
  security_approver_account_id,
  approved_at,
  started_at,
  expires_at
)
VALUES (
  $1, $2, $3, 'active', $4, 'jira', $5, $6, $7, now(), now(),
  now() + ($8::text || ' minutes')::interval
)
RETURNING id;
`,
    [
      actor.instanceId,
      actorAccountId,
      targetAccountId,
      ticketId,
      ticketState,
      approverAccountId,
      securityApproverAccountId ?? null,
      durationMinutes,
    ]
  );
  const workflowId = insert.rows[0]?.id;
  if (!workflowId) {
    return { operation: 'start_impersonation', status: 'error', reasonCode: 'database_unavailable' };
  }

  logger.warn('Impersonation started', {
    operation: 'impersonate_start',
    ticket_id: ticketId,
    actor_pseudonym: pseudonymize(actor.keycloakSubject),
    target_pseudonym: pseudonymize(targetSubject),
    max_duration_s: durationMinutes * 60,
    ...buildGovernanceLogContext(actor.instanceId),
  });

  await emitGovernanceAuditEvent(client, {
    instanceId: actor.instanceId,
    actorAccountId,
    actorSubject: actor.keycloakSubject,
    targetSubject,
    targetRef: workflowId,
    ticketId,
    eventType: 'governance_impersonation_started',
    action: 'impersonation_start',
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
    durationSeconds: durationMinutes * 60,
  });

  return { operation: 'start_impersonation', status: 'ok', workflowId };
};

const endImpersonation = async (
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const sessionId = readString(payload.sessionId);
  const reason = readString(payload.reason) ?? 'manual_end';
  if (!sessionId || !isUuid(sessionId)) {
    return { operation: 'end_impersonation', status: 'error', reasonCode: 'invalid_request' };
  }

  const actorAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });
  if (!actorAccountId) {
    return { operation: 'end_impersonation', status: 'error', reasonCode: 'unauthorized' };
  }

  const update = await client.query<{ started_at: string; ticket_id: string }>(
    `
UPDATE iam.impersonation_sessions
SET
  status = 'terminated',
  ended_at = now(),
  termination_reason = $3,
  updated_at = now()
WHERE id = $1
  AND instance_id = $2
  AND actor_account_id = $4
  AND status = 'active'
RETURNING started_at, ticket_id;
`,
    [sessionId, actor.instanceId, reason, actorAccountId]
  );
  if (update.rowCount <= 0) {
    return { operation: 'end_impersonation', status: 'error', reasonCode: 'invalid_request' };
  }

  const startedAtRaw = update.rows[0]?.started_at;
  const durationSeconds =
    startedAtRaw && Number.isFinite(new Date(startedAtRaw).getTime())
      ? Math.max(0, Math.floor((Date.now() - new Date(startedAtRaw).getTime()) / 1000))
      : undefined;
  const ticketId = update.rows[0]?.ticket_id;

  logger.warn('Impersonation ended', {
    operation: 'impersonate_end',
    ticket_id: ticketId,
    duration_s: durationSeconds,
    ...buildGovernanceLogContext(actor.instanceId),
  });

  await emitGovernanceAuditEvent(client, {
    instanceId: actor.instanceId,
    actorAccountId,
    actorSubject: actor.keycloakSubject,
    targetRef: sessionId,
    ticketId,
    eventType: 'governance_impersonation_ended',
    action: 'impersonation_end',
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
    durationSeconds,
  });

  return { operation: 'end_impersonation', status: 'ok', workflowId: sessionId };
};

const acceptLegalText = async (
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>,
  revoked: boolean
): Promise<GovernanceWorkflowResponse> => {
  const legalTextId = readString(payload.legalTextId);
  const legalTextVersion = readString(payload.legalTextVersion);
  const locale = readString(payload.locale) ?? 'de-DE';
  const contentHash = readString(payload.contentHash) ?? 'unknown';
  if (!legalTextId || !legalTextVersion) {
    return {
      operation: revoked ? 'revoke_legal_acceptance' : 'accept_legal_text',
      status: 'error',
      reasonCode: 'invalid_request',
    };
  }

  const actorAccountId = await resolveAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });
  if (!actorAccountId) {
    return {
      operation: revoked ? 'revoke_legal_acceptance' : 'accept_legal_text',
      status: 'error',
      reasonCode: 'unauthorized',
    };
  }

  const versionLookup = await client.query<{ id: string }>(
    `
INSERT INTO iam.legal_text_versions (
  instance_id,
  legal_text_id,
  legal_text_version,
  locale,
  content_hash,
  is_active
)
VALUES ($1, $2, $3, $4, $5, true)
ON CONFLICT (instance_id, legal_text_id, legal_text_version, locale) DO UPDATE
SET is_active = true
RETURNING id;
`,
    [actor.instanceId, legalTextId, legalTextVersion, locale, contentHash]
  );

  const legalVersionId = versionLookup.rows[0]?.id;
  if (!legalVersionId) {
    return {
      operation: revoked ? 'revoke_legal_acceptance' : 'accept_legal_text',
      status: 'error',
      reasonCode: 'database_unavailable',
    };
  }

  if (!revoked) {
    await client.query(
      `
INSERT INTO iam.legal_text_acceptances (
  instance_id,
  legal_text_version_id,
  account_id,
  accepted_at,
  request_id,
  trace_id
)
VALUES ($1, $2, $3, now(), $4, $5);
`,
      [actor.instanceId, legalVersionId, actorAccountId, actor.requestId ?? null, actor.traceId ?? null]
    );
  } else {
    await client.query(
      `
UPDATE iam.legal_text_acceptances
SET revoked_at = now(), revocation_reason = COALESCE($4, 'user_revoke')
WHERE instance_id = $1
  AND legal_text_version_id = $2
  AND account_id = $3
  AND revoked_at IS NULL;
`,
      [actor.instanceId, legalVersionId, actorAccountId, readString(payload.reason) ?? null]
    );
  }

  const operation = revoked ? 'revoke_legal_acceptance' : 'accept_legal_text';
  const eventType = revoked ? 'governance_legal_acceptance_revoked' : 'governance_legal_accepted';
  await emitGovernanceAuditEvent(client, {
    instanceId: actor.instanceId,
    actorAccountId,
    actorSubject: actor.keycloakSubject,
    targetRef: `${legalTextId}:${legalTextVersion}:${locale}`,
    eventType,
    action: operation,
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  return { operation, status: 'ok', workflowId: legalVersionId };
};

const executeWorkflow = async (
  client: QueryClient,
  actor: GovernanceActor,
  request: GovernanceWorkflowRequest
): Promise<GovernanceWorkflowResponse> => {
  switch (request.operation) {
    case 'submit_permission_change':
      return submitPermissionChange(client, actor, request.payload);
    case 'approve_permission_change':
      return approvePermissionChange(client, actor, request.payload);
    case 'apply_permission_change':
      return applyPermissionChange(client, actor, request.payload);
    case 'create_delegation':
      return createDelegation(client, actor, request.payload);
    case 'revoke_delegation':
      return revokeDelegation(client, actor, request.payload);
    case 'start_impersonation':
      return startImpersonation(client, actor, request.payload);
    case 'end_impersonation':
      return endImpersonation(client, actor, request.payload);
    case 'accept_legal_text':
      return acceptLegalText(client, actor, request.payload, false);
    case 'revoke_legal_acceptance':
      return acceptLegalText(client, actor, request.payload, true);
    default:
      return { operation: request.operation, status: 'error', reasonCode: 'invalid_request' };
  }
};

const csvEscape = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return '';
  }
  const raw = String(value);
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

type ComplianceRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  request_id: string | null;
  trace_id: string | null;
  created_at: string;
};

const loadComplianceRows = async (
  client: QueryClient,
  input: { instanceId: string; from?: string; to?: string }
): Promise<ComplianceRow[]> => {
  const rows = await client.query<ComplianceRow>(
    `
SELECT
  id,
  event_type,
  payload,
  request_id,
  trace_id,
  created_at
FROM iam.activity_logs
WHERE instance_id = $1
  AND event_type LIKE 'governance_%'
  AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)
  AND ($3::timestamptz IS NULL OR created_at <= $3::timestamptz)
ORDER BY created_at ASC;
`,
    [input.instanceId, input.from ?? null, input.to ?? null]
  );

  return rows.rows;
};

const toExportRows = (rows: readonly ComplianceRow[]) =>
  rows.map((row) => {
    const payload = row.payload ?? {};
    const payloadRecord = typeof payload === 'object' && payload !== null ? payload : {};
    return {
      event_id: readString(payloadRecord.event_id) ?? row.id,
      timestamp: readString(payloadRecord.timestamp) ?? row.created_at,
      instance_id: readString(payloadRecord.instance_id),
      action: readString(payloadRecord.action),
      result: readString(payloadRecord.result),
      actor_pseudonym: readString(payloadRecord.actor_pseudonym),
      target_ref: readString(payloadRecord.target_ref),
      reason_code: readString(payloadRecord.reason_code),
      request_id: readString(payloadRecord.request_id) ?? row.request_id ?? undefined,
      trace_id: readString(payloadRecord.trace_id) ?? row.trace_id ?? undefined,
      event_type: row.event_type,
    };
  });

export const governanceWorkflowHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const parsed = await parseWorkflowRequest(request);
      if (!parsed) {
        return jsonResponse(400, { error: 'invalid_request' });
      }
      if (!isUuid(parsed.instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== parsed.instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }
      if (
        requiresPrivilegedWorkflowRole(parsed.operation) &&
        !hasRequiredRole(user.roles, GOVERNANCE_WORKFLOW_ROLES)
      ) {
        logger.warn('Governance workflow denied due to missing role', {
          operation: parsed.operation,
          reason_code: 'forbidden',
          ...buildGovernanceLogContext(parsed.instanceId),
        });
        return jsonResponse(403, { error: 'forbidden' });
      }

      const actor: GovernanceActor = {
        keycloakSubject: user.id,
        instanceId: parsed.instanceId,
        roles: user.roles,
        requestId: getWorkspaceContext().requestId,
        traceId: getWorkspaceContext().traceId,
      };

      try {
        const result = await withInstanceScopedDb(parsed.instanceId, async (client) => {
          return executeWorkflow(client, actor, parsed);
        });
        if (result.status === 'error') {
          logger.error('Governance workflow rejected', {
            operation: parsed.operation,
            reason_code: result.reasonCode,
            ...buildGovernanceLogContext(parsed.instanceId),
          });
          return jsonResponse(400, result);
        }
        logger.info('Governance workflow completed', {
          operation: parsed.operation,
          workflow_id: result.workflowId,
          ...buildGovernanceLogContext(parsed.instanceId),
        });
        return jsonResponse(200, result);
      } catch (error) {
        logger.error('Governance workflow failed', {
          operation: parsed.operation,
          error: error instanceof Error ? error.message : String(error),
          ...buildGovernanceLogContext(parsed.instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const governanceComplianceExportHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      if (!hasRequiredRole(user.roles, GOVERNANCE_COMPLIANCE_EXPORT_ROLES)) {
        logger.warn('Governance compliance export denied due to missing role', {
          operation: 'compliance_export',
          reason_code: 'forbidden',
          ...buildGovernanceLogContext(user.instanceId),
        });
        return jsonResponse(403, { error: 'forbidden' });
      }

      const url = new URL(request.url);
      const instanceId = readString(url.searchParams.get('instanceId')) ?? user.instanceId;
      const format = (readString(url.searchParams.get('format')) ?? 'json').toLowerCase();
      const from = readString(url.searchParams.get('from'));
      const to = readString(url.searchParams.get('to'));

      if (!instanceId || !isUuid(instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        const exportRows = await withInstanceScopedDb(instanceId, async (client) => {
          const rows = await loadComplianceRows(client, { instanceId, from, to });
          return toExportRows(rows);
        });

        if (format === 'csv') {
          const header = [
            'event_id',
            'timestamp',
            'instance_id',
            'action',
            'result',
            'actor_pseudonym',
            'target_ref',
            'reason_code',
            'request_id',
            'trace_id',
            'event_type',
          ];
          const lines = [header.join(',')];
          for (const row of exportRows) {
            lines.push(
              [
                row.event_id,
                row.timestamp,
                row.instance_id,
                row.action,
                row.result,
                row.actor_pseudonym,
                row.target_ref,
                row.reason_code,
                row.request_id,
                row.trace_id,
                row.event_type,
              ]
                .map(csvEscape)
                .join(',')
            );
          }
          return new Response(lines.join('\n'), {
            status: 200,
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
            },
          });
        }

        if (format === 'siem') {
          const siem = exportRows.map((row) => ({
            '@timestamp': row.timestamp,
            event_id: row.event_id,
            instance_id: row.instance_id,
            action: row.action,
            result: row.result,
            actor_pseudonym: row.actor_pseudonym,
            target_ref: row.target_ref,
            reason_code: row.reason_code,
            request_id: row.request_id,
            trace_id: row.trace_id,
            event_type: row.event_type,
          }));
          return jsonResponse(200, { format: 'siem', rows: siem });
        }

        return jsonResponse(200, { format: 'json', rows: exportRows });
      } catch (error) {
        logger.error('Governance compliance export failed', {
          operation: 'compliance_export',
          error: error instanceof Error ? error.message : String(error),
          format,
          ...buildGovernanceLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const resolveImpersonationSubject = async (input: {
  instanceId: string;
  actorKeycloakSubject: string;
  targetKeycloakSubject: string;
}): Promise<{ ok: true } | { ok: false; reasonCode: string }> => {
  try {
    return await withInstanceScopedDb(input.instanceId, async (client) => {
      const actorAccountId = await resolveAccountId(client, {
        instanceId: input.instanceId,
        keycloakSubject: input.actorKeycloakSubject,
      });
      const targetAccountId = await resolveAccountId(client, {
        instanceId: input.instanceId,
        keycloakSubject: input.targetKeycloakSubject,
      });
      if (!actorAccountId || !targetAccountId) {
        return { ok: false, reasonCode: 'DENY_INSTANCE_SCOPE_MISMATCH' } as const;
      }

      const active = await client.query<{ id: string; expires_at: string; ticket_id: string }>(
        `
SELECT id, expires_at, ticket_id
FROM iam.impersonation_sessions
WHERE instance_id = $1
  AND actor_account_id = $2
  AND target_account_id = $3
  AND status = 'active'
ORDER BY started_at DESC
LIMIT 1;
`,
        [input.instanceId, actorAccountId, targetAccountId]
      );
      if (active.rowCount <= 0) {
        return { ok: false, reasonCode: 'DENY_TICKET_REQUIRED' } as const;
      }
      const session = active.rows[0];
      if (!session) {
        return { ok: false, reasonCode: 'DENY_TICKET_REQUIRED' } as const;
      }

      const expiresAt = new Date(session.expires_at);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        await client.query(
          `
UPDATE iam.impersonation_sessions
SET status = 'expired', ended_at = now(), termination_reason = 'timeout', updated_at = now()
WHERE id = $1
  AND instance_id = $2;
`,
          [session.id, input.instanceId]
        );

        logger.warn('Impersonation session expired', {
          operation: 'impersonate_timeout',
          ticket_id: session.ticket_id,
          ...buildGovernanceLogContext(input.instanceId),
        });

        await emitGovernanceAuditEvent(client, {
          instanceId: input.instanceId,
          actorAccountId,
          actorSubject: input.actorKeycloakSubject,
          targetSubject: input.targetKeycloakSubject,
          targetRef: session.id,
          ticketId: session.ticket_id,
          eventType: 'governance_impersonation_expired',
          action: 'impersonation_timeout',
          result: 'failure',
          reasonCode: 'DENY_IMPERSONATION_DURATION_EXCEEDED',
          requestId: getWorkspaceContext().requestId,
          traceId: getWorkspaceContext().traceId,
        });

        return { ok: false, reasonCode: 'DENY_IMPERSONATION_DURATION_EXCEEDED' } as const;
      }

      return { ok: true } as const;
    });
  } catch {
    return { ok: false, reasonCode: 'database_unavailable' };
  }
};
