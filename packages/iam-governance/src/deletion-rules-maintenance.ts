import type { IamDeletionContentStrategy, IamDeletionLifecycleState } from '@sva/core';

import type { QueryClient } from './query-client.js';
import {
  resolveDefaultDeletionContentStrategy,
  resolveEffectiveDeletionContentStrategy,
  resolveTenantDeletionThresholds,
  type DeletionRulesMaintenanceCandidateRow,
} from './deletion-rules.types.js';

export type DeletionRulesMaintenanceInput = {
  instanceId: string;
  dryRun: boolean;
  now?: Date;
};

export type DeletionRulesMaintenanceResult = {
  instanceId: string;
  evaluatedAccounts: number;
  deactivatedAccounts: number;
  pseudonymizedAccounts: number;
  deletedAccounts: number;
  tombstonedContents: number;
};

const dayInMs = 24 * 60 * 60 * 1000;

const lifecycleOrder: Record<IamDeletionLifecycleState, number> = {
  active: 0,
  deactivated: 1,
  pseudonymized: 2,
  deleted: 3,
};

const strategyStartState: Record<
  Exclude<IamDeletionContentStrategy, 'retain'>,
  Extract<IamDeletionLifecycleState, 'deactivated' | 'pseudonymized' | 'deleted'>
> = {
  on_deactivation: 'deactivated',
  on_pseudonymization: 'pseudonymized',
  on_deletion: 'deleted',
};

const loadMaintenanceCandidates = async (
  client: QueryClient,
  input: { instanceId: string }
): Promise<readonly DeletionRulesMaintenanceCandidateRow[]> => {
  const result = await client.query<DeletionRulesMaintenanceCandidateRow>(
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
  account.id::text AS id,
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
  AND account.deletion_lifecycle_state IN ('active', 'deactivated', 'pseudonymized')
ORDER BY login_events.last_login_at ASC NULLS LAST, account.id ASC;
`,
    [input.instanceId]
  );

  return result.rows;
};

const hasReachedThreshold = (lastLoginAt: string, days: number, now: Date): boolean =>
  Date.parse(lastLoginAt) + days * dayInMs <= now.getTime();

const resolveNextLifecycleState = (
  candidate: DeletionRulesMaintenanceCandidateRow,
  now: Date
): IamDeletionLifecycleState | undefined => {
  if (!candidate.last_login_at) {
    return undefined;
  }

  const thresholds = resolveTenantDeletionThresholds(candidate);

  if (candidate.deletion_lifecycle_state === 'active') {
    return hasReachedThreshold(candidate.last_login_at, thresholds.deactivateAfterDays, now)
      ? 'deactivated'
      : undefined;
  }
  if (candidate.deletion_lifecycle_state === 'deactivated') {
    return hasReachedThreshold(candidate.last_login_at, thresholds.pseudonymizeAfterDays, now)
      ? 'pseudonymized'
      : undefined;
  }
  if (candidate.deletion_lifecycle_state === 'pseudonymized') {
    return hasReachedThreshold(candidate.last_login_at, thresholds.deleteAfterDays, now) ? 'deleted' : undefined;
  }

  return undefined;
};

const shouldApplyContentTransition = (
  strategy: IamDeletionContentStrategy,
  nextState: IamDeletionLifecycleState
): boolean => {
  if (strategy === 'retain') {
    return false;
  }

  return lifecycleOrder[nextState] >= lifecycleOrder[strategyStartState[strategy]];
};

const updateAccountLifecycleState = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; nextState: IamDeletionLifecycleState }
): Promise<void> => {
  await client.query(
    `
UPDATE iam.accounts
SET
  deletion_lifecycle_state = $3,
  deactivated_at = CASE
    WHEN $3 = 'deactivated' AND deactivated_at IS NULL THEN NOW()
    ELSE deactivated_at
  END,
  pseudonymized_at = CASE
    WHEN $3 = 'pseudonymized' AND pseudonymized_at IS NULL THEN NOW()
    ELSE pseudonymized_at
  END,
  deletion_marked_at = CASE
    WHEN $3 = 'deleted' AND deletion_marked_at IS NULL THEN NOW()
    ELSE deletion_marked_at
  END,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
    [input.instanceId, input.accountId, input.nextState]
  );
};

const updateContentLifecycleState = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; nextState: IamDeletionLifecycleState }
): Promise<number> => {
  const result = await client.query(
    `
UPDATE iam.contents
SET
  deletion_lifecycle_state = $3,
  deletion_lifecycle_changed_at = NOW(),
  author_display_name = CASE
    WHEN $3 = 'pseudonymized' THEN 'Pseudonymisiert'
    WHEN $3 = 'deleted' THEN 'Gelöscht'
    ELSE author_display_name
  END
WHERE instance_id = $1
  AND author_account_id = $2::uuid;
`,
    [input.instanceId, input.accountId, input.nextState]
  );

  return result.rowCount;
};

export const runDeletionRulesMaintenance = async (
  client: QueryClient,
  input: DeletionRulesMaintenanceInput
): Promise<DeletionRulesMaintenanceResult> => {
  const now = input.now ?? new Date();
  const rows = await loadMaintenanceCandidates(client, { instanceId: input.instanceId });
  const candidates = rows
    .filter((row) => row.last_login_at !== null)
    .map((row) => ({
      row,
      nextState: resolveNextLifecycleState(row, now),
    }));

  const summary: DeletionRulesMaintenanceResult = {
    instanceId: input.instanceId,
    evaluatedAccounts: candidates.length,
    deactivatedAccounts: 0,
    pseudonymizedAccounts: 0,
    deletedAccounts: 0,
    tombstonedContents: 0,
  };

  for (const candidate of candidates) {
    if (!candidate.nextState) {
      continue;
    }

    if (candidate.nextState === 'deactivated') {
      summary.deactivatedAccounts += 1;
    } else if (candidate.nextState === 'pseudonymized') {
      summary.pseudonymizedAccounts += 1;
    } else if (candidate.nextState === 'deleted') {
      summary.deletedAccounts += 1;
    }

    if (input.dryRun) {
      continue;
    }

    await updateAccountLifecycleState(client, {
      instanceId: input.instanceId,
      accountId: candidate.row.id,
      nextState: candidate.nextState,
    });

    const contentStrategy = resolveEffectiveDeletionContentStrategy(
      resolveDefaultDeletionContentStrategy(candidate.row.default_content_strategy),
      candidate.row.override_content_strategy
    );

    if (!shouldApplyContentTransition(contentStrategy, candidate.nextState)) {
      continue;
    }

    summary.tombstonedContents += await updateContentLifecycleState(client, {
      instanceId: input.instanceId,
      accountId: candidate.row.id,
      nextState: candidate.nextState,
    });
  }

  return summary;
};
