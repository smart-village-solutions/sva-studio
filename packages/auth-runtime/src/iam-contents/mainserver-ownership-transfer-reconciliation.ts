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
           completed_steps = completed_steps || jsonb_build_array($3::text),
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
