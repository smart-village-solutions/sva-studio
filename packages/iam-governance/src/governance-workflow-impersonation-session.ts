import { getWorkspaceContext } from '@sva/server-runtime';
import { resolveGovernanceAccountId } from './governance-audit-shared.js';
import {
  emitGovernanceAuditEvent,
  type GovernanceWorkflowExecutorDeps,
} from './governance-workflow-shared.js';
import type { QueryClient } from './query-client.js';

const resolveActiveImpersonationSession = async (
  client: QueryClient,
  input: {
    actorAccountId: string;
    instanceId: string;
    targetAccountId: string;
  }
) =>
  client.query<{ id: string; expires_at: string; ticket_id: string }>(
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
    [input.instanceId, input.actorAccountId, input.targetAccountId]
  );

const expireImpersonationSession = async (
  deps: GovernanceWorkflowExecutorDeps,
  client: QueryClient,
  input: {
    actorAccountId: string;
    actorKeycloakSubject: string;
    instanceId: string;
    sessionId: string;
    targetKeycloakSubject: string;
    ticketId: string;
  }
): Promise<{ ok: false; reasonCode: 'DENY_IMPERSONATION_DURATION_EXCEEDED' }> => {
  await client.query(
    `
UPDATE iam.impersonation_sessions
SET status = 'expired', ended_at = now(), termination_reason = 'timeout', updated_at = now()
WHERE id = $1
  AND instance_id = $2;
`,
    [input.sessionId, input.instanceId]
  );

  deps.logWarn('Impersonation session expired', {
    operation: 'impersonate_timeout',
    ticket_id: input.ticketId,
    ...deps.buildLogContext(input.instanceId),
  });

  await emitGovernanceAuditEvent(deps, client, {
    instanceId: input.instanceId,
    actorAccountId: input.actorAccountId,
    actorSubject: input.actorKeycloakSubject,
    targetSubject: input.targetKeycloakSubject,
    targetRef: input.sessionId,
    ticketId: input.ticketId,
    eventType: 'governance_impersonation_expired',
    action: 'impersonation_timeout',
    result: 'failure',
    reasonCode: 'DENY_IMPERSONATION_DURATION_EXCEEDED',
    requestId: getWorkspaceContext().requestId,
    traceId: getWorkspaceContext().traceId,
  });

  return { ok: false, reasonCode: 'DENY_IMPERSONATION_DURATION_EXCEEDED' };
};

export const resolveImpersonationSubject = async (
  deps: GovernanceWorkflowExecutorDeps,
  input: {
    withInstanceScopedDb: <T>(
      instanceId: string,
      work: (client: QueryClient) => Promise<T>
    ) => Promise<T>;
    instanceId: string;
    actorKeycloakSubject: string;
    targetKeycloakSubject: string;
  }
): Promise<{ ok: true } | { ok: false; reasonCode: string }> => {
  try {
    return await input.withInstanceScopedDb(input.instanceId, async (client) => {
      const actorAccountId = await resolveGovernanceAccountId(client, {
        instanceId: input.instanceId,
        keycloakSubject: input.actorKeycloakSubject,
      });
      const targetAccountId = await resolveGovernanceAccountId(client, {
        instanceId: input.instanceId,
        keycloakSubject: input.targetKeycloakSubject,
      });
      if (!actorAccountId || !targetAccountId) {
        return { ok: false, reasonCode: 'DENY_INSTANCE_SCOPE_MISMATCH' } as const;
      }

      const active = await resolveActiveImpersonationSession(client, {
        actorAccountId,
        instanceId: input.instanceId,
        targetAccountId,
      });
      if (active.rowCount <= 0) {
        return { ok: false, reasonCode: 'DENY_TICKET_REQUIRED' } as const;
      }
      const session = active.rows[0];
      if (!session) {
        return { ok: false, reasonCode: 'DENY_TICKET_REQUIRED' } as const;
      }

      const expiresAt = new Date(session.expires_at);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        return expireImpersonationSession(deps, client, {
          actorAccountId,
          actorKeycloakSubject: input.actorKeycloakSubject,
          instanceId: input.instanceId,
          sessionId: session.id,
          targetKeycloakSubject: input.targetKeycloakSubject,
          ticketId: session.ticket_id,
        });
      }

      return { ok: true } as const;
    });
  } catch {
    return { ok: false, reasonCode: 'database_unavailable' };
  }
};
