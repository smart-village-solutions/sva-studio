import { withInstanceScopedDb } from '../iam-account-management/shared.js';

export const deferMainserverMutationProjection = async (input: {
  readonly instanceId: string;
  readonly operationExternalId: string;
}): Promise<boolean> => {
  const operationExternalId = input.operationExternalId.trim();
  if (!operationExternalId) throw new Error('mainserver_operation_external_id_required');

  return withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<{ deferred: boolean }>(
      `
WITH deferred_update AS (
  UPDATE iam.mainserver_mutation_journal
  SET
    reconciliation_status = 'reconciliation_required',
    completed_steps = (
      SELECT COALESCE(jsonb_agg(step ORDER BY step), '[]'::jsonb)
      FROM (
        SELECT DISTINCT jsonb_array_elements_text(
          completed_steps || '["projection_follow_up_deferred"]'::jsonb
        ) AS step
      ) AS distinct_steps
    ),
    last_error_code = COALESCE(
      last_error_code,
      'mainserver_projection_credential_cooldown'
    ),
    completed_at = NULL,
    updated_at = NOW()
  WHERE instance_id = $1
    AND operation_external_id = $2
    AND provider_outcome = 'succeeded'
    AND reconciliation_status IN ('complete', 'reconciliation_required')
    AND NOT (completed_steps ? 'projection_history_reconciled')
    AND NOT (completed_steps ? 'projection_follow_up_deferred')
  RETURNING 1
)
SELECT
  EXISTS (SELECT 1 FROM deferred_update)
  OR EXISTS (
    SELECT 1
    FROM iam.mainserver_mutation_journal
    WHERE instance_id = $1
      AND operation_external_id = $2
      AND provider_outcome = 'succeeded'
      AND reconciliation_status = 'reconciliation_required'
      AND completed_steps ? 'projection_follow_up_deferred'
      AND NOT (completed_steps ? 'projection_history_reconciled')
  ) AS deferred;
      `,
      [input.instanceId, operationExternalId]
    );
    return result.rows[0]?.deferred === true;
  });
};
