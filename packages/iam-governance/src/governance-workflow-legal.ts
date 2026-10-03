import { getWorkspaceContext } from '@sva/server-runtime';
import type { GovernanceOperation } from './governance-workflow-policy.js';
import { resolveGovernanceAccountId } from './governance-audit-shared.js';
import {
  emitGovernanceAuditEvent,
  type GovernanceActor,
  type GovernanceWorkflowExecutorDeps,
  type GovernanceWorkflowResponse,
} from './governance-workflow-shared.js';
import { readString } from './input-readers.js';
import type { QueryClient } from './query-client.js';

type GovernanceOperationResult = Readonly<{
  eventType: string;
  operation: GovernanceOperation;
}>;

const resolveLegalAcceptanceMetadata = (revoked: boolean): GovernanceOperationResult => {
  if (revoked) {
    return {
      operation: 'revoke_legal_acceptance',
      eventType: 'governance_legal_acceptance_revoked',
    };
  }

  return {
    operation: 'accept_legal_text',
    eventType: 'governance_legal_accepted',
  };
};

const persistLegalAcceptance = async (
  client: QueryClient,
  actor: GovernanceActor,
  input: {
    legalVersionId: string;
    actorAccountId: string;
    legalTextVersion: string;
    revoked: boolean;
    reason: string | undefined;
  }
): Promise<void> => {
  if (!input.revoked) {
    const requestWorkspaceId = getWorkspaceContext().workspaceId;
    const workspaceId =
      requestWorkspaceId && requestWorkspaceId !== 'default'
        ? requestWorkspaceId
        : actor.instanceId;
    await client.query(
      `
INSERT INTO iam.legal_text_acceptances (
  instance_id,
  workspace_id,
  subject_id,
  legal_text_version_id,
  account_id,
  accepted_at,
  legal_text_version,
  action_type,
  request_id,
  trace_id
)
VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9);
`,
      [
        actor.instanceId,
        workspaceId,
        actor.keycloakSubject,
        input.legalVersionId,
        input.actorAccountId,
        input.legalTextVersion,
        'accepted',
        actor.requestId ?? null,
        actor.traceId ?? null,
      ]
    );
  } else {
    await client.query(
      `
UPDATE iam.legal_text_acceptances
SET revoked_at = now(), revocation_reason = COALESCE($4, 'user_revoke'), action_type = 'revoked'
WHERE instance_id = $1
  AND legal_text_version_id = $2
  AND account_id = $3
  AND revoked_at IS NULL;
`,
      [actor.instanceId, input.legalVersionId, input.actorAccountId, input.reason ?? null]
    );
  }
};

export const acceptLegalText = async (
  deps: GovernanceWorkflowExecutorDeps,
  client: QueryClient,
  actor: GovernanceActor,
  payload: Record<string, unknown>,
  revoked: boolean
): Promise<GovernanceWorkflowResponse> => {
  const legalAcceptance = resolveLegalAcceptanceMetadata(revoked);
  const legalTextId = readString(payload.legalTextId);
  const legalTextVersion = readString(payload.legalTextVersion);
  const locale = readString(payload.locale) ?? 'de-DE';
  if (!legalTextId || !legalTextVersion) {
    return {
      operation: legalAcceptance.operation,
      status: 'error',
      reasonCode: 'invalid_request',
    };
  }

  const actorAccountId = await resolveGovernanceAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject: actor.keycloakSubject,
  });
  if (!actorAccountId) {
    return {
      operation: legalAcceptance.operation,
      status: 'error',
      reasonCode: 'unauthorized',
    };
  }

  const versionLookup = await client.query<{ id: string }>(
    `
SELECT id
FROM iam.legal_text_versions
WHERE instance_id = $1
  AND legal_text_id = $2
  AND legal_text_version = $3
  AND locale = $4
  AND is_active = true
LIMIT 1;
`,
    [actor.instanceId, legalTextId, legalTextVersion, locale]
  );

  const legalVersionId = versionLookup.rows[0]?.id;
  if (!legalVersionId) {
    return {
      operation: legalAcceptance.operation,
      status: 'error',
      reasonCode: 'legal_text_version_not_active',
    };
  }

  await persistLegalAcceptance(client, actor, {
    legalVersionId,
    actorAccountId,
    legalTextVersion,
    revoked,
    reason: revoked ? readString(payload.reason) : undefined,
  });

  await emitGovernanceAuditEvent(deps, client, {
    instanceId: actor.instanceId,
    actorAccountId,
    actorSubject: actor.keycloakSubject,
    targetRef: `${legalTextId}:${legalTextVersion}:${locale}`,
    eventType: legalAcceptance.eventType,
    action: legalAcceptance.operation,
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  return { operation: legalAcceptance.operation, status: 'ok', workflowId: legalVersionId };
};
