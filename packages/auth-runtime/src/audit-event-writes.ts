import type { AuthAuditEvent, AuthAuditEventType } from './audit-events.types.js';
import type { AuditSqlClient } from './audit-db-sink.js';
import type { RuntimeScopeRef } from './types.js';

export const insertActivityLog = async (
  client: AuditSqlClient,
  input: {
    eventType: AuthAuditEventType;
    instanceId: string;
    accountId?: string;
    actorUserId?: string;
    outcome: AuthAuditEvent['outcome'];
    pluginAction?: AuthAuditEvent['pluginAction'];
    requestId?: string;
    traceId?: string;
  }
) => {
  const payload = {
    outcome: input.outcome,
    actor_user_id: input.actorUserId ?? null,
    ...(input.pluginAction
      ? {
          action_id: input.pluginAction.actionId,
          action_namespace: input.pluginAction.actionNamespace,
          action_owner: input.pluginAction.actionOwner,
          result: input.pluginAction.result,
          reason_code: input.pluginAction.reasonCode ?? null,
          resource_type: input.pluginAction.resourceType ?? null,
          resource_id: input.pluginAction.resourceId ?? null,
          batch_summary: input.pluginAction.batchSummary,
          ...(input.pluginAction.mainserverMutation
            ? {
                acting_principal_type: input.pluginAction.mainserverMutation.actingPrincipalType,
                acting_principal_id: input.pluginAction.mainserverMutation.actingPrincipalId,
                active_organization_id:
                  input.pluginAction.mainserverMutation.activeOrganizationId ?? null,
                credential_source: input.pluginAction.mainserverMutation.credentialSource,
                credential_fingerprint: input.pluginAction.mainserverMutation.credentialFingerprint,
                data_provider_id: input.pluginAction.mainserverMutation.dataProviderId ?? null,
                authorization_mode: input.pluginAction.mainserverMutation.authorizationMode,
                resolver_mode: input.pluginAction.mainserverMutation.resolverMode ?? null,
                candidate_authorization_mode:
                  input.pluginAction.mainserverMutation.candidateAuthorizationMode ?? null,
                candidate_allowed: input.pluginAction.mainserverMutation.candidateAllowed ?? null,
                shadow_difference: input.pluginAction.mainserverMutation.shadowDifference ?? null,
                operation_external_id: input.pluginAction.mainserverMutation.operationExternalId,
                provider_outcome: input.pluginAction.mainserverMutation.providerOutcome ?? null,
                reconciliation_status:
                  input.pluginAction.mainserverMutation.reconciliationStatus ?? null,
              }
            : {}),
        }
      : {}),
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
      input.accountId ?? null,
      input.eventType,
      JSON.stringify(payload),
      input.requestId ?? null,
      input.traceId ?? null,
    ]
  );
};

const insertPlatformActivityLog = async (
  client: AuditSqlClient,
  input: {
    eventType: AuthAuditEventType;
    accountId?: string;
    actorUserId?: string;
    outcome: AuthAuditEvent['outcome'];
    pluginAction?: AuthAuditEvent['pluginAction'];
    requestId?: string;
    traceId?: string;
  }
) => {
  const payload = {
    outcome: input.outcome,
    actor_user_id: input.actorUserId ?? null,
    ...(input.pluginAction
      ? {
          action_id: input.pluginAction.actionId,
          action_namespace: input.pluginAction.actionNamespace,
          action_owner: input.pluginAction.actionOwner,
          result: input.pluginAction.result,
          reason_code: input.pluginAction.reasonCode ?? null,
          resource_type: input.pluginAction.resourceType ?? null,
          resource_id: input.pluginAction.resourceId ?? null,
          batch_summary: input.pluginAction.batchSummary,
        }
      : {}),
  };

  await client.query(
    `
INSERT INTO iam.platform_activity_logs (
  scope_kind,
  account_id,
  event_type,
  actor_user_id,
  payload,
  request_id,
  trace_id
)
VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7);
`,
    [
      'platform',
      input.accountId ?? null,
      input.eventType,
      input.actorUserId ?? null,
      JSON.stringify(payload),
      input.requestId ?? null,
      input.traceId ?? null,
    ]
  );
};

export const writeScopedAuditEvent = async (
  client: AuditSqlClient,
  scope: RuntimeScopeRef,
  input: {
    eventType: AuthAuditEventType;
    accountId?: string;
    actorUserId?: string;
    outcome: AuthAuditEvent['outcome'];
    pluginAction?: AuthAuditEvent['pluginAction'];
    requestId?: string;
    traceId?: string;
  }
) => {
  if (scope.kind === 'platform') {
    await insertPlatformActivityLog(client, input);
    return;
  }

  await insertActivityLog(client, {
    ...input,
    instanceId: scope.instanceId,
  });
};
