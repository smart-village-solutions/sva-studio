import type { QueryClient } from './query-client.js';

import type { MyDeletionRulesRow, TenantDeletionRulesRow } from './deletion-rules.types.js';

export class DeletionRulesAccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`deletion_rules_account_not_found:${accountId}`);
    this.name = 'DeletionRulesAccountNotFoundError';
  }
}

const queryTenantDeletionRulesRow = (client: QueryClient, input: { instanceId: string }) =>
  client.query<TenantDeletionRulesRow>(
    `
SELECT
  instance_id,
  deactivate_after_days,
  pseudonymize_after_days,
  delete_after_days,
  default_content_strategy
FROM iam.instance_deletion_rules
WHERE instance_id = $1
LIMIT 1;
`,
    [input.instanceId]
  );

const queryMyDeletionRulesRow = (client: QueryClient, input: { instanceId: string; accountId: string }) =>
  client.query<MyDeletionRulesRow>(
    `
WITH last_login_events AS (
  SELECT
    log.account_id,
    MAX(log.created_at)::text AS last_login_at
  FROM iam.activity_logs log
  WHERE log.instance_id = $1
    AND log.event_type = 'login'
    AND log.account_id IS NOT NULL
  GROUP BY log.account_id
)
SELECT
  account.id::text AS account_id,
  login_events.last_login_at,
  account.deletion_lifecycle_state,
  rules.deactivate_after_days,
  rules.pseudonymize_after_days,
  rules.delete_after_days,
  rules.default_content_strategy,
  preference.content_strategy AS override_content_strategy
FROM iam.accounts account
LEFT JOIN iam.instance_deletion_rules rules
  ON rules.instance_id = account.instance_id
LEFT JOIN iam.account_deletion_content_preferences preference
  ON preference.instance_id = account.instance_id
 AND preference.account_id = account.id
LEFT JOIN last_login_events login_events
  ON login_events.account_id = account.id
WHERE account.instance_id = $1
  AND account.id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.accountId]
  );

export const loadTenantDeletionRulesRow = async (
  client: QueryClient,
  input: { instanceId: string }
): Promise<TenantDeletionRulesRow | undefined> => {
  const result = await queryTenantDeletionRulesRow(client, input);

  return result.rows[0];
};

export const loadMyDeletionRulesRow = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<MyDeletionRulesRow> => {
  const result = await queryMyDeletionRulesRow(client, input);
  const row = result.rows[0];

  if (!row) {
    throw new DeletionRulesAccountNotFoundError(input.accountId);
  }

  return row;
};
