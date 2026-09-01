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
       ) AS unresolved;`,
      [input.instanceId, input.contentType, input.contentId]
    );
    return result.rows[0]?.unresolved === true;
  });

export type RecoverableMainserverOwnershipTransfer = Readonly<{
  operationExternalId: string;
  targetPrincipal: Readonly<{
    type: 'account' | 'organization';
    id: string;
  }>;
}>;

type RecoverableOwnershipTransferRow = Readonly<{
  operation_external_id: string;
  target_principal_type: string;
  target_principal_id: string;
}>;

export const loadRecoverableMainserverOwnershipTransfers = async (input: {
  readonly instanceId: string;
  readonly contentType: string;
  readonly contentId: string;
  readonly currentDataProviderId: string;
}): Promise<readonly RecoverableMainserverOwnershipTransfer[]> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<RecoverableOwnershipTransferRow>(
      `SELECT operation_external_id,
              preimage->>'targetPrincipalType' AS target_principal_type,
              preimage->>'targetPrincipalId' AS target_principal_id
       FROM iam.mainserver_mutation_journal
       WHERE instance_id = $1
         AND action_id = 'content.transferOwnership'
         AND content_type = $2
         AND content_id = $3
         AND provider_outcome IN ('pending', 'unknown', 'succeeded')
         AND reconciliation_status IN ('pending', 'reconciliation_required')
         AND expected_data_provider_id = $4
         AND preimage->>'targetPrincipalType' IN ('account', 'organization')
         AND NULLIF(BTRIM(preimage->>'targetPrincipalId'), '') IS NOT NULL
       ORDER BY created_at ASC, operation_external_id ASC;`,
      [input.instanceId, input.contentType, input.contentId, input.currentDataProviderId]
    );
    return result.rows.map((row) => ({
      operationExternalId: row.operation_external_id,
      targetPrincipal: {
        type: row.target_principal_type as 'account' | 'organization',
        id: row.target_principal_id,
      },
    }));
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
