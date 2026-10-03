import { randomUUID } from 'node:crypto';
import {
  pseudonymizeGovernanceSubject,
  resolveGovernanceAccountId,
} from './governance-audit-shared.js';
import type { GovernanceOperation } from './governance-workflow-policy.js';
import type { QueryClient } from './query-client.js';

export type GovernanceWorkflowRequest = {
  operation: GovernanceOperation;
  instanceId: string;
  payload: Record<string, unknown>;
};

export type GovernanceWorkflowResponse = {
  operation: GovernanceOperation;
  status: 'ok' | 'error';
  workflowId?: string;
  reasonCode?: string;
  message?: string;
};

export type GovernanceActor = {
  keycloakSubject: string;
  instanceId: string;
  roles: readonly string[];
  capabilities?: Readonly<{
    requiresIndependentSecurityApproverForImpersonation?: boolean;
  }>;
  requestId?: string;
  traceId?: string;
};

export type GovernanceWorkflowExecutorDeps = {
  readonly isUuid: (value: string) => boolean;
  readonly logInfo: (message: string, fields: Record<string, unknown>) => void;
  readonly logWarn: (message: string, fields: Record<string, unknown>) => void;
  readonly buildLogContext: (instanceId?: string) => Record<string, unknown>;
};

export const resolveActorAccountId = (
  client: QueryClient,
  actor: GovernanceActor
): Promise<string | undefined> =>
  resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });

export const emitGovernanceAuditEvent = async (
  deps: GovernanceWorkflowExecutorDeps,
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
    actor_pseudonym: input.actorSubject
      ? pseudonymizeGovernanceSubject(input.actorSubject)
      : undefined,
    target_ref: input.targetRef,
    target_pseudonym: input.targetSubject
      ? pseudonymizeGovernanceSubject(input.targetSubject)
      : undefined,
    reason_code: input.reasonCode,
    request_id: input.requestId,
    trace_id: input.traceId,
    ticket_id: input.ticketId,
    duration_s: input.durationSeconds,
  };

  const log = input.result === 'success' ? deps.logInfo : deps.logWarn;
  log('Governance audit event emitted', {
    operation: input.action,
    event_type: input.eventType,
    result: input.result,
    actor_pseudonym: payload.actor_pseudonym,
    target_pseudonym: payload.target_pseudonym,
    ticket_id: input.ticketId,
    duration_s: input.durationSeconds,
    reason_code: input.reasonCode,
    sink: 'otel',
    ...deps.buildLogContext(input.instanceId),
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
