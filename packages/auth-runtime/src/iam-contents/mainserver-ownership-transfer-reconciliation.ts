import { revealField } from '@sva/iam-admin';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';

const required = (value: string, code: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
};

export const hasUnresolvedMainserverOwnershipTransfer = async (input: {
  readonly instanceId: string;
  readonly contentType: string;
  readonly contentId: string;
  readonly excludeOperationExternalId?: string;
}): Promise<boolean> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<{ unresolved: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM iam.mainserver_mutation_journal
         WHERE instance_id = $1
           AND action_id = 'content.transferOwnership'
           AND content_type = $2
           AND content_id = $3
           AND reconciliation_status IN ('pending', 'reconciliation_required')
           AND ($4::text IS NULL OR operation_external_id <> $4)
       ) AS unresolved;`,
      [
        input.instanceId,
        input.contentType,
        input.contentId,
        input.excludeOperationExternalId ?? null,
      ]
    );
    return result.rows[0]?.unresolved === true;
  });

export type RecoverableMainserverOwnershipTransfer = Readonly<{
  operationExternalId: string;
  expectedDataProviderId: string;
  actor: Readonly<{
    instanceId: string;
    actorAccountId: string;
    keycloakSubject: string;
    actorDisplayName: string;
    activeOrganizationId?: string;
    actingPrincipalType: 'user' | 'organization';
    credentialFingerprint: string;
  }>;
  targetPrincipal: Readonly<{
    type: 'account' | 'organization';
    id: string;
  }>;
}>;

type RecoverableOwnershipTransferRow = Readonly<{
  operation_external_id: string;
  expected_data_provider_id: string;
  target_principal_type: string;
  target_principal_id: string;
  actor_account_id: string | null;
  keycloak_subject: string | null;
  display_name_ciphertext: string | null;
  active_organization_id: string | null;
  acting_principal_type: 'user' | 'organization';
  credential_fingerprint: string;
}>;

export const loadRecoverableMainserverOwnershipTransfers = async (input: {
  readonly instanceId: string;
  readonly contentType: string;
  readonly contentId: string;
  readonly currentDataProviderId: string;
}): Promise<readonly RecoverableMainserverOwnershipTransfer[]> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<RecoverableOwnershipTransferRow>(
      `SELECT journal.operation_external_id,
              journal.expected_data_provider_id,
              journal.preimage->>'targetPrincipalType' AS target_principal_type,
              journal.preimage->>'targetPrincipalId' AS target_principal_id,
              journal.actor_account_id::text,
              accounts.keycloak_subject,
              accounts.display_name_ciphertext,
              journal.active_organization_id::text,
              journal.acting_principal_type,
              journal.credential_fingerprint
       FROM iam.mainserver_mutation_journal AS journal
       LEFT JOIN iam.accounts AS accounts
         ON accounts.instance_id = journal.instance_id
        AND accounts.id = journal.actor_account_id
       WHERE journal.instance_id = $1
         AND journal.action_id = 'content.transferOwnership'
         AND journal.content_type = $2
         AND journal.content_id = $3
         AND journal.provider_outcome IN ('pending', 'unknown', 'succeeded')
         AND journal.reconciliation_status IN ('pending', 'reconciliation_required')
         AND journal.expected_data_provider_id = $4
         AND journal.preimage->>'targetPrincipalType' IN ('account', 'organization')
         AND NULLIF(BTRIM(journal.preimage->>'targetPrincipalId'), '') IS NOT NULL
       ORDER BY journal.created_at ASC, journal.operation_external_id ASC;`,
      [input.instanceId, input.contentType, input.contentId, input.currentDataProviderId]
    );
    return result.rows.map((row) => {
      if (
        !row.actor_account_id ||
        !row.keycloak_subject ||
        (row.acting_principal_type === 'organization' && !row.active_organization_id)
      ) {
        throw new Error('content_transfer_original_actor_context_unavailable');
      }
      return {
        operationExternalId: row.operation_external_id,
        expectedDataProviderId: row.expected_data_provider_id,
        actor: {
          instanceId: input.instanceId,
          actorAccountId: row.actor_account_id,
          keycloakSubject: row.keycloak_subject,
          actorDisplayName:
            revealField(
              row.display_name_ciphertext,
              'iam.accounts.display_name:' + row.keycloak_subject
            ) ?? row.keycloak_subject,
          ...(row.active_organization_id
            ? { activeOrganizationId: row.active_organization_id }
            : {}),
          actingPrincipalType: row.acting_principal_type,
          credentialFingerprint: row.credential_fingerprint,
        },
        targetPrincipal: {
          type: row.target_principal_type as 'account' | 'organization',
          id: row.target_principal_id,
        },
      };
    });
  });

export const markMainserverMutationReconciliationRequired = async (input: {
  readonly instanceId: string;
  readonly operationExternalId: string;
  readonly completedStep: string;
  readonly lastErrorCode: string;
}): Promise<void> => {
  await withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query(
      `UPDATE iam.mainserver_mutation_journal
       SET reconciliation_status = 'reconciliation_required',
           completed_steps = (
             SELECT COALESCE(jsonb_agg(step ORDER BY step), '[]'::jsonb)
             FROM (
               SELECT DISTINCT jsonb_array_elements_text(
                 completed_steps || jsonb_build_array($3::text)
               ) AS step
             ) AS distinct_steps
           ),
           last_error_code = $4,
           updated_at = NOW()
       WHERE instance_id = $1
         AND operation_external_id = $2;`,
      [
        input.instanceId,
        required(input.operationExternalId, 'mainserver_operation_external_id_required'),
        required(input.completedStep, 'mainserver_completed_step_required'),
        required(input.lastErrorCode, 'mainserver_last_error_code_required'),
      ]
    );
  });
};
