import { IAM_DELETED_CONTENT_AUTHOR_TOKEN } from '@sva/core';

import type { QueryClient } from './query-client.js';
import { readEffectiveAccountDeletionContentStrategy } from './user-detail-query.sql.js';

const readActiveLegalHold = async (
  client: QueryClient,
  params: readonly [string, string]
): Promise<{ rowCount: number }> =>
  client.query<{ id: string }>(
    `
SELECT id
FROM iam.legal_holds
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND active = true
  AND (hold_until IS NULL OR hold_until > NOW())
LIMIT 1;
`,
    params
  );

const accountDeleteBlockerStatements = [
  `
DELETE FROM iam.permission_change_requests
WHERE instance_id = $1
  AND (requester_account_id = $2::uuid OR target_account_id = $2::uuid);
`,
  `
DELETE FROM iam.delegations
WHERE instance_id = $1
  AND (delegator_account_id = $2::uuid OR delegatee_account_id = $2::uuid);
`,
  `
DELETE FROM iam.impersonation_sessions
WHERE instance_id = $1
  AND (actor_account_id = $2::uuid OR target_account_id = $2::uuid);
`,
  `
DELETE FROM iam.legal_text_acceptances
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
  `
DELETE FROM iam.legal_holds
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND NOT (
    active = true
    AND (hold_until IS NULL OR hold_until > NOW())
  );
`,
  `
UPDATE iam.legal_holds
SET created_by_account_id = NULL
WHERE instance_id = $1
  AND created_by_account_id = $2::uuid;
`,
  `
UPDATE iam.legal_holds
SET lifted_by_account_id = NULL
WHERE instance_id = $1
  AND lifted_by_account_id = $2::uuid;
`,
  `
DELETE FROM iam.data_subject_export_jobs
WHERE instance_id = $1
  AND target_account_id = $2::uuid;
`,
  `
UPDATE iam.data_subject_export_jobs
SET requested_by_account_id = NULL
WHERE instance_id = $1
  AND requested_by_account_id = $2::uuid;
`,
  `
DELETE FROM iam.account_profile_corrections
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
  `
UPDATE iam.account_profile_corrections
SET actor_account_id = NULL
WHERE instance_id = $1
  AND actor_account_id = $2::uuid;
`,
  `
UPDATE iam.data_subject_request_events
SET actor_account_id = NULL
WHERE instance_id = $1
  AND actor_account_id = $2::uuid;
`,
  `
DELETE FROM iam.data_subject_requests
WHERE instance_id = $1
  AND target_account_id = $2::uuid;
`,
  `
UPDATE iam.data_subject_requests
SET requester_account_id = NULL
WHERE instance_id = $1
  AND requester_account_id = $2::uuid;
`,
] as const;

const executeAccountDeleteBlockerStatements = async (
  client: QueryClient,
  params: readonly [string, string]
): Promise<void> => {
  for (const statement of accountDeleteBlockerStatements) {
    await client.query(statement, params);
  }
};

export const anonymizeRetainedOwnedContent = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; keycloakSubject: string; deletedLabel?: string }
): Promise<void> => {
  await client.query(
    `
UPDATE iam.contents
SET
  author_display_name = CASE
    WHEN author_account_id = $2::uuid THEN $3
    ELSE author_display_name
  END,
  author_account_id = CASE
    WHEN author_account_id = $2::uuid THEN NULL
    ELSE author_account_id
  END,
  creator_account_id = CASE
    WHEN creator_account_id = $2::uuid THEN NULL
    ELSE creator_account_id
  END,
  updater_account_id = CASE
    WHEN updater_account_id = $2::uuid THEN NULL
    ELSE updater_account_id
  END,
  owner_subject_id = CASE
    WHEN owner_subject_id = $4 THEN NULL
    ELSE owner_subject_id
  END,
  owner_user_id = CASE
    WHEN owner_user_id = $2::uuid THEN NULL
    ELSE owner_user_id
  END,
  updated_at = NOW()
WHERE instance_id = $1
  AND (
    author_account_id = $2::uuid
    OR creator_account_id = $2::uuid
    OR updater_account_id = $2::uuid
    OR owner_subject_id = $4
    OR owner_user_id = $2::uuid
  );
`,
    [input.instanceId, input.accountId, input.deletedLabel ?? IAM_DELETED_CONTENT_AUTHOR_TOKEN, input.keycloakSubject]
  );
};

export const markOwnedContentDeletedForAccountRemoval = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; keycloakSubject: string; deletedLabel?: string }
): Promise<void> => {
  await client.query(
    `
UPDATE iam.contents
SET
  deletion_lifecycle_state = 'deleted',
  deletion_lifecycle_changed_at = NOW(),
  updated_at = NOW(),
  author_display_name = CASE
    WHEN author_account_id = $2::uuid THEN $4
    ELSE author_display_name
  END,
  owner_subject_id = CASE
    WHEN owner_subject_id = $3 THEN NULL
    ELSE owner_subject_id
  END,
  owner_user_id = CASE
    WHEN owner_user_id = $2::uuid THEN NULL
    ELSE owner_user_id
  END
WHERE instance_id = $1
  AND (
    author_account_id = $2::uuid
    OR owner_subject_id = $3
    OR owner_user_id = $2::uuid
  );
`,
    [input.instanceId, input.accountId, input.keycloakSubject, input.deletedLabel ?? IAM_DELETED_CONTENT_AUTHOR_TOKEN]
  );
};

export const reconcileOwnedContentForAccountDelete = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; keycloakSubject: string }
): Promise<void> => {
  const effectiveContentStrategy = await readEffectiveAccountDeletionContentStrategy(client, input);

  if (effectiveContentStrategy === 'retain') {
    await anonymizeRetainedOwnedContent(client, input);
    return;
  }

  await markOwnedContentDeletedForAccountRemoval(client, input);
};

export const purgeAccountHardDeleteBlockers = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<void> => {
  const params = [input.instanceId, input.accountId] as const;
  await executeAccountDeleteBlockerStatements(client, params);
};

export const assertAccountHardDeletePreconditions = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<void> => {
  const params = [input.instanceId, input.accountId] as const;
  const activeLegalHoldResult = await readActiveLegalHold(client, params);
  if (activeLegalHoldResult.rowCount > 0) {
    throw new Error('legal_hold_delete_protection:Aktiver Legal Hold blockiert die Löschung.');
  }
};

export const hardDeleteAccount = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<void> => {
  const result = await client.query<{ id: string }>(
    `
DELETE FROM iam.accounts
WHERE id = $1::uuid
  AND instance_id = $2
RETURNING id;
`,
    [input.accountId, input.instanceId]
  );

  if (result.rowCount !== 1) {
    throw new Error('account_delete_not_found_or_not_deleted');
  }
};
