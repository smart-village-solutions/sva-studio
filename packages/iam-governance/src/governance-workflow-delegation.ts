import {
  pseudonymizeGovernanceSubject,
  resolveGovernanceAccountId,
} from './governance-audit-shared.js';
import {
  normalizeDelegationPayload,
  resolveDelegationAccountDecision,
  resolveDelegationDecision,
  resolveDelegationStatus,
} from './governance-delegation-decision.js';
import {
  emitGovernanceAuditEvent,
  type GovernanceActor,
  type GovernanceWorkflowExecutorDeps,
  type GovernanceWorkflowResponse,
} from './governance-workflow-shared.js';
import { readString } from './input-readers.js';
import type { QueryClient } from './query-client.js';

const resolveDelegationEventMetadata = (status: 'active' | 'requested') => {
  if (status === 'active') {
    return {
      action: 'delegation_create',
      eventType: 'governance_delegation_created',
    };
  }

  return {
    action: 'delegation_request',
    eventType: 'governance_delegation_requested',
  };
};

const insertDelegation = (
  client: QueryClient,
  input: {
    instanceId: string;
    delegatorAccountId: string;
    delegateeAccountId: string;
    roleId: string;
    status: 'active' | 'requested';
    approverAccountId: string;
    ticketId: string;
    ticketState: string;
    startDate: Date;
    endDate: Date;
  }
) =>
  client.query<{ id: string }>(
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
      input.instanceId,
      input.delegatorAccountId,
      input.delegateeAccountId,
      input.roleId,
      input.status,
      input.approverAccountId,
      input.ticketId,
      input.ticketState,
      input.startDate.toISOString(),
      input.endDate.toISOString(),
    ]
  );

export const createDelegation = async (
  deps: GovernanceWorkflowExecutorDeps,
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const delegationDecision = resolveDelegationDecision(
    normalizeDelegationPayload(payload, actor.keycloakSubject),
    deps.isUuid
  );
  if (!delegationDecision.ok) {
    return {
      operation: 'create_delegation',
      status: 'error',
      reasonCode: delegationDecision.reasonCode,
    };
  }
  const {
    approverSubject,
    delegateeSubject,
    delegatorSubject,
    endDate,
    roleId,
    startDate,
    ticketId,
    ticketState,
  } = delegationDecision.value;

  const resolvedDelegatorAccountId = await resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: delegatorSubject,
  });
  const resolvedDelegateeAccountId = await resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: delegateeSubject,
  });
  const resolvedApproverAccountId = await resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: approverSubject,
  });
  const accountDecision = resolveDelegationAccountDecision({
    delegatorAccountId: resolvedDelegatorAccountId,
    delegateeAccountId: resolvedDelegateeAccountId,
    approverAccountId: resolvedApproverAccountId,
  });
  if (!accountDecision.ok) {
    return {
      operation: 'create_delegation',
      status: 'error',
      reasonCode: accountDecision.reasonCode,
    };
  }
  const { approverAccountId, delegateeAccountId, delegatorAccountId } = accountDecision.value;
  const status = resolveDelegationStatus(startDate, Date.now());

  const inserted = await insertDelegation(client, {
    instanceId: actor.instanceId,
    delegatorAccountId,
    delegateeAccountId,
    roleId,
    status,
    approverAccountId,
    ticketId,
    ticketState,
    startDate,
    endDate,
  });
  const workflowId = inserted.rows[0]?.id;
  if (!workflowId) {
    return { operation: 'create_delegation', status: 'error', reasonCode: 'database_unavailable' };
  }

  const delegationEvent = resolveDelegationEventMetadata(status);
  await emitGovernanceAuditEvent(deps, client, {
    instanceId: actor.instanceId,
    actorAccountId: delegatorAccountId,
    actorSubject: delegatorSubject,
    targetSubject: delegateeSubject,
    targetRef: workflowId,
    ticketId,
    eventType: delegationEvent.eventType,
    action: delegationEvent.action,
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  deps.logWarn('Delegation workflow event', {
    operation: delegationEvent.action,
    delegation_id: workflowId,
    actor_pseudonym: pseudonymizeGovernanceSubject(delegatorSubject),
    target_pseudonym: pseudonymizeGovernanceSubject(delegateeSubject),
    ...deps.buildLogContext(actor.instanceId),
  });

  return { operation: 'create_delegation', status: 'ok', workflowId };
};

export const revokeDelegation = async (
  deps: GovernanceWorkflowExecutorDeps,
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>
): Promise<GovernanceWorkflowResponse> => {
  const delegationId = readString(payload.delegationId);
  if (!delegationId || !deps.isUuid(delegationId)) {
    return { operation: 'revoke_delegation', status: 'error', reasonCode: 'invalid_request' };
  }

  const actorAccountId = await resolveGovernanceAccountId(client, {
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

  await emitGovernanceAuditEvent(deps, client, {
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
