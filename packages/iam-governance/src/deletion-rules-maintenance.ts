import {
  IAM_DELETED_CONTENT_AUTHOR_TOKEN,
  IAM_PSEUDONYMIZED_CONTENT_AUTHOR_TOKEN,
  type IamDeletionContentStrategy,
  type IamDeletionLifecycleState,
} from '@sva/core';

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
  revokeUserSessions?: (input: {
    keycloakSubject: string;
    nextState: BlockingLifecycleState;
    reason: 'account_lifecycle_blocked';
  }) => Promise<void>;
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

type BlockingLifecycleState = Exclude<IamDeletionLifecycleState, 'active'>;

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
    AND log.result = 'success'
    AND log.account_id IS NOT NULL
  GROUP BY log.account_id
)
SELECT
  account.id::text AS id,
  account.keycloak_subject,
  login_events.last_login_at,
  account.deletion_lifecycle_state,
  rules.deactivate_after_days,
  rules.pseudonymize_after_days,
  rules.delete_after_days,
  rules.default_content_strategy,
  rules.allow_content_preference_override,
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
): BlockingLifecycleState | undefined => {
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
  return strategy === 'with_owner_lifecycle' && lifecycleOrder[nextState] >= lifecycleOrder.deactivated;
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
  email_ciphertext = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE email_ciphertext
  END,
  display_name_ciphertext = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE display_name_ciphertext
  END,
  first_name_ciphertext = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE first_name_ciphertext
  END,
  last_name_ciphertext = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE last_name_ciphertext
  END,
  phone_ciphertext = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE phone_ciphertext
  END,
  username_ciphertext = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE username_ciphertext
  END,
  notes = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE notes
  END,
  avatar_url = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE avatar_url
  END,
  position = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE position
  END,
  department = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE department
  END,
  preferred_language = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE preferred_language
  END,
  timezone = CASE
    WHEN $3 IN ('pseudonymized', 'deleted') THEN NULL
    ELSE timezone
  END,
  status = CASE WHEN $3 IN ('pseudonymized', 'deleted') THEN 'inactive' ELSE status END,
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
  updated_at = NOW(),
  author_display_name = CASE
    WHEN $3 = 'pseudonymized' THEN $4
    WHEN $3 = 'deleted' THEN $5
    ELSE author_display_name
  END
WHERE instance_id = $1
  AND author_account_id = $2::uuid
  AND deletion_lifecycle_state IS DISTINCT FROM $3;
`,
    [
      input.instanceId,
      input.accountId,
      input.nextState,
      IAM_PSEUDONYMIZED_CONTENT_AUTHOR_TOKEN,
      IAM_DELETED_CONTENT_AUTHOR_TOKEN,
    ]
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
    await input.revokeUserSessions?.({
      keycloakSubject: candidate.row.keycloak_subject,
      nextState: candidate.nextState,
      reason: 'account_lifecycle_blocked',
    });

    const contentStrategy = resolveEffectiveDeletionContentStrategy(
      resolveDefaultDeletionContentStrategy(candidate.row.default_content_strategy),
      candidate.row.allow_content_preference_override ? candidate.row.override_content_strategy : null
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
