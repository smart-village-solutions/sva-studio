import {
  pseudonymizeGovernanceSubject,
  resolveGovernanceAccountId,
} from './governance-audit-shared.js';
import { validateGovernanceTicketState } from './governance-workflow-policy.js';
import {
  emitGovernanceAuditEvent,
  resolveActorAccountId,
  type GovernanceActor,
  type GovernanceWorkflowExecutorDeps,
  type GovernanceWorkflowResponse,
} from './governance-workflow-shared.js';
import { readNumber, readString } from './input-readers.js';
import type { QueryClient } from './query-client.js';

const MAX_IMPERSONATION_MINUTES = 120;

const insertImpersonationSession = (
  client: QueryClient,
  input: {
    instanceId: string;
    actorAccountId: string;
    targetAccountId: string;
    ticketId: string;
    ticketState: string | undefined;
    approverAccountId: string;
    securityApproverAccountId: string | undefined;
    durationMinutes: number;
  }
) =>
  client.query<{ id: string }>(
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
      input.instanceId,
      input.actorAccountId,
      input.targetAccountId,
      input.ticketId,
      input.ticketState,
      input.approverAccountId,
      input.securityApproverAccountId ?? null,
      input.durationMinutes,
    ]
  );

const auditImpersonationStart = async (
  deps: GovernanceWorkflowExecutorDeps,
  client: QueryClient,
  actor: GovernanceActor,
  input: {
    actorAccountId: string;
    targetSubject: string;
    workflowId: string;
    ticketId: string;
    durationMinutes: number;
  }
): Promise<void> => {
  deps.logWarn('Impersonation started', {
    operation: 'impersonate_start',
    ticket_id: input.ticketId,
    actor_pseudonym: pseudonymizeGovernanceSubject(actor.keycloakSubject),
    target_pseudonym: pseudonymizeGovernanceSubject(input.targetSubject),
    max_duration_s: input.durationMinutes * 60,
    ...deps.buildLogContext(actor.instanceId),
  });

  await emitGovernanceAuditEvent(deps, client, {
    instanceId: actor.instanceId,
    actorAccountId: input.actorAccountId,
    actorSubject: actor.keycloakSubject,
    targetSubject: input.targetSubject,
    targetRef: input.workflowId,
    ticketId: input.ticketId,
    eventType: 'governance_impersonation_started',
    action: 'impersonation_start',
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
    durationSeconds: input.durationMinutes * 60,
  });
};

export const startImpersonation = async (
  deps: GovernanceWorkflowExecutorDeps,
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

  const ticketValidation = validateGovernanceTicketState(ticketState);
  if (!ticketValidation.ok) {
    return {
      operation: 'start_impersonation',
      status: 'error',
      reasonCode: ticketValidation.reasonCode,
    };
  }

  if (durationMinutes <= 0 || durationMinutes > MAX_IMPERSONATION_MINUTES) {
    return {
      operation: 'start_impersonation',
      status: 'error',
      reasonCode: 'DENY_IMPERSONATION_DURATION_EXCEEDED',
    };
  }

  const actorAccountId = await resolveActorAccountId(client, actor);
  const targetAccountId = await resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: targetSubject,
  });
  const approverAccountId = await resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: approverSubject,
  });
  if (!actorAccountId || !targetAccountId || !approverAccountId) {
    return { operation: 'start_impersonation', status: 'error', reasonCode: 'unauthorized' };
  }
  if (actorAccountId === approverAccountId) {
    return { operation: 'start_impersonation', status: 'error', reasonCode: 'DENY_SELF_APPROVAL' };
  }

  const securityApproverResult = await resolveSecurityApproverAccountId(client, actor, {
    actorAccountId,
    securityApproverSubject,
  });
  if (!securityApproverResult.ok) {
    return {
      operation: 'start_impersonation',
      status: 'error',
      reasonCode: securityApproverResult.reasonCode,
    };
  }

  const insert = await insertImpersonationSession(client, {
    instanceId: actor.instanceId,
    actorAccountId,
    targetAccountId,
    ticketId,
    ticketState,
    approverAccountId,
    securityApproverAccountId: securityApproverResult.accountId,
    durationMinutes,
  });
  const workflowId = insert.rows[0]?.id;
  if (!workflowId) {
    return {
      operation: 'start_impersonation',
      status: 'error',
      reasonCode: 'database_unavailable',
    };
  }

  await auditImpersonationStart(deps, client, actor, {
    actorAccountId,
    targetSubject,
    workflowId,
    ticketId,
    durationMinutes,
  });

  return { operation: 'start_impersonation', status: 'ok', workflowId };
};

export const endImpersonation = async (
  deps: GovernanceWorkflowExecutorDeps,
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const sessionId = readString(payload.sessionId);
  const reason = readString(payload.reason) ?? 'manual_end';
  if (!sessionId || !deps.isUuid(sessionId)) {
    return { operation: 'end_impersonation', status: 'error', reasonCode: 'invalid_request' };
  }

  const actorAccountId = await resolveActorAccountId(client, actor);
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
  const durationSeconds = calculateImpersonationDurationSeconds(startedAtRaw);
  const ticketId = update.rows[0]?.ticket_id;

  deps.logWarn('Impersonation ended', {
    operation: 'impersonate_end',
    ticket_id: ticketId,
    duration_s: durationSeconds,
    ...deps.buildLogContext(actor.instanceId),
  });

  await emitGovernanceAuditEvent(deps, client, {
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

const resolveSecurityApproverAccountId = async (
  client: QueryClient,
  actor: GovernanceActor,
  input: {
    actorAccountId: string;
    securityApproverSubject?: string;
  }
): Promise<
  | { ok: true; accountId?: string }
  | { ok: false; reasonCode: GovernanceWorkflowResponse['reasonCode'] }
> => {
  if (!actor.capabilities?.requiresIndependentSecurityApproverForImpersonation) {
    return { ok: true };
  }

  if (!input.securityApproverSubject) {
    return { ok: false, reasonCode: 'DENY_SELF_APPROVAL' };
  }

  const accountId = await resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: input.securityApproverSubject,
  });
  if (!accountId || accountId === input.actorAccountId) {
    return { ok: false, reasonCode: 'DENY_SELF_APPROVAL' };
  }

  return { ok: true, accountId };
};

const calculateImpersonationDurationSeconds = (
  startedAtRaw: string | undefined
): number | undefined => {
  if (!startedAtRaw) {
    return undefined;
  }

  const startedAt = new Date(startedAtRaw);
  if (!Number.isFinite(startedAt.getTime())) {
    return undefined;
  }

  return Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
};
