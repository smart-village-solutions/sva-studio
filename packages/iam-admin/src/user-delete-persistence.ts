import { IAM_DELETED_CONTENT_AUTHOR_TOKEN } from '@sva/core';

import type { QueryClient } from './query-client.js';
import { readEffectiveAccountDeletionContentStrategy } from './user-detail-query.sql.js';

export const anonymizeRetainedOwnedContent = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; deletedLabel?: string }
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
  updated_at = NOW()
WHERE instance_id = $1
  AND (
    author_account_id = $2::uuid
    OR creator_account_id = $2::uuid
    OR updater_account_id = $2::uuid
  );
`,
    [input.instanceId, input.accountId, input.deletedLabel ?? IAM_DELETED_CONTENT_AUTHOR_TOKEN]
  );
};

export const markOwnedContentDeletedForAccountRemoval = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; deletedLabel?: string }
): Promise<void> => {
  await client.query(
    `
UPDATE iam.contents
SET
  deletion_lifecycle_state = 'deleted',
  deletion_lifecycle_changed_at = NOW(),
  updated_at = NOW(),
  author_display_name = CASE
    WHEN author_account_id = $2::uuid THEN $3
    ELSE author_display_name
  END
WHERE instance_id = $1
  AND author_account_id = $2::uuid;
`,
    [input.instanceId, input.accountId, input.deletedLabel ?? IAM_DELETED_CONTENT_AUTHOR_TOKEN]
  );
};

export const reconcileOwnedContentForAccountDelete = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<void> => {
  const effectiveContentStrategy = await readEffectiveAccountDeletionContentStrategy(client, input);

  if (effectiveContentStrategy === 'retain') {
    await anonymizeRetainedOwnedContent(client, input);
    return;
  }

  await markOwnedContentDeletedForAccountRemoval(client, input);
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
