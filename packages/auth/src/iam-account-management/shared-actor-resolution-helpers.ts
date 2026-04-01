import type { ApiErrorCode } from '@sva/core';

import { jitProvisionAccountWithClient } from '../jit-provisioning.server.js';

import { createApiError } from './api-helpers.js';
import { addActiveSpanEvent, annotateActiveSpan, createActorResolutionDetails } from './diagnostics.js';
import { logger } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import type { QueryClient } from '../shared/db-helpers.js';

export const resolveActorAccountIdWithProvision = async (input: {
  instanceId: string;
  keycloakSubject: string;
  requestId?: string;
  traceId?: string;
  mayProvisionMissingActorMembership: boolean;
  resolveActorAccountId: (
    client: QueryClient,
    params: { instanceId: string; keycloakSubject: string }
  ) => Promise<string | undefined>;
}): Promise<string | undefined> => {
  const existingAccountId = await withInstanceScopedDb(input.instanceId, (client) =>
    input.resolveActorAccountId(client, {
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
    })
  );
  if (existingAccountId || !input.mayProvisionMissingActorMembership) {
    return existingAccountId;
  }

  return (
    await withInstanceScopedDb(input.instanceId, (client) =>
      jitProvisionAccountWithClient(client, {
        instanceId: input.instanceId,
        keycloakSubject: input.keycloakSubject,
        requestId: input.requestId,
        traceId: input.traceId,
      })
    )
  ).accountId;
};

export const createInstanceLookupError = (
  resolvedInstance: { reason: 'database_unavailable' | 'missing_instance' | 'invalid_instance' },
  requestId?: string,
  requestedInstanceId?: string
): {
  status: number;
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  requestedInstanceId?: string;
} => ({
  status: resolvedInstance.reason === 'database_unavailable' ? 503 : 400,
  code: resolvedInstance.reason === 'database_unavailable' ? 'database_unavailable' : 'invalid_instance_id',
  message:
    resolvedInstance.reason === 'database_unavailable'
      ? 'IAM-Datenbank ist nicht erreichbar.'
      : 'Ungültige oder fehlende instanceId.',
  requestId,
  requestedInstanceId,
});

export const resolveMissingActorDiagnosticReason = async (instanceId: string, keycloakSubject: string) => {
  try {
    const diagnosticRow = await withInstanceScopedDb(instanceId, async (client) => {
      const result = await client.query<{
        account_exists: boolean;
        membership_exists: boolean;
      }>(
        `
SELECT
  EXISTS(SELECT 1 FROM iam.accounts WHERE keycloak_subject = $1) AS account_exists,
  EXISTS(
    SELECT 1
    FROM iam.accounts a
    JOIN iam.instance_memberships im
      ON im.account_id = a.id
     AND im.instance_id = $2
    WHERE a.keycloak_subject = $1
  ) AS membership_exists;
`,
        [keycloakSubject, instanceId]
      );
      return result.rows[0];
    });

    if (diagnosticRow?.account_exists) {
      return diagnosticRow.membership_exists
        ? 'missing_actor_account'
        : 'missing_instance_membership';
    }
  } catch {
    // Prefer the original 403 path over masking with an auxiliary diagnostics failure.
  }

  return 'missing_actor_account';
};

export const createMissingActorMembershipError = (input: {
  diagnosticReason: 'missing_actor_account' | 'missing_instance_membership';
  instanceId: string;
  userId: string;
  sessionInstanceId?: string;
  mayProvisionMissingActorMembership: boolean;
  requestId?: string;
  traceId?: string;
}) => {
  annotateActiveSpan({
    'iam.actor_resolution': input.diagnosticReason,
    'iam.reason_code': input.diagnosticReason,
    'iam.instance_id': input.instanceId,
  });
  addActiveSpanEvent('iam.actor_resolution_rejected', {
    'iam.reason_code': input.diagnosticReason,
    'iam.instance_id': input.instanceId,
  });
  logger.warn('IAM actor resolution rejected request without actor membership', {
    operation: 'resolve_actor',
    user_id: input.userId,
    instance_id: input.instanceId,
    session_instance_id: input.sessionInstanceId,
    allow_jit_provision: input.mayProvisionMissingActorMembership,
    actor_account_id: null,
    diagnostic_reason: input.diagnosticReason,
    request_id: input.requestId,
    trace_id: input.traceId,
  });
  return {
    error: createApiError(
      403,
      'forbidden',
      'Akteur-Account nicht gefunden.',
      input.requestId,
      createActorResolutionDetails({
        actorResolution: input.diagnosticReason,
        instanceId: input.instanceId,
      })
    ),
  };
};
