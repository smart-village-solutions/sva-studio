import type { IamDeletionContentStrategy } from '@sva/core';

import type { QueryClient } from '../db.js';
import type { TenantDeletionRulesPayload } from './payloads.js';

type AccountLookupRow = {
  id: string;
};

export const resolveActorAccountId = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<string | undefined> => {
  const result = await client.query<AccountLookupRow>(
    `
SELECT a.id::text AS id
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );

  return result.rows[0]?.id;
};

export const upsertTenantDeletionRules = async (
  client: QueryClient,
  payload: TenantDeletionRulesPayload
): Promise<void> => {
  await client.query(
    `
INSERT INTO iam.instance_deletion_rules (
  instance_id,
  deactivate_after_days,
  pseudonymize_after_days,
  delete_after_days,
  default_content_strategy,
  allow_content_preference_override
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (instance_id) DO UPDATE
SET
  deactivate_after_days = EXCLUDED.deactivate_after_days,
  pseudonymize_after_days = EXCLUDED.pseudonymize_after_days,
  delete_after_days = EXCLUDED.delete_after_days,
  default_content_strategy = EXCLUDED.default_content_strategy,
  allow_content_preference_override = EXCLUDED.allow_content_preference_override,
  updated_at = NOW();
`,
    [
      payload.instanceId,
      payload.deactivateAfterDays,
      payload.pseudonymizeAfterDays,
      payload.deleteAfterDays,
      payload.defaultContentStrategy,
      payload.allowContentPreferenceOverride,
    ]
  );
};

export const saveAccountContentPreference = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; strategy?: IamDeletionContentStrategy }
): Promise<void> => {
  if (!input.strategy) {
    await client.query(
      `
DELETE FROM iam.account_deletion_content_preferences
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
      [input.instanceId, input.accountId]
    );
    return;
  }

  await client.query(
    `
INSERT INTO iam.account_deletion_content_preferences (
  instance_id,
  account_id,
  content_strategy
)
VALUES ($1, $2::uuid, $3)
ON CONFLICT (instance_id, account_id) DO UPDATE
SET
  content_strategy = EXCLUDED.content_strategy,
  updated_at = NOW();
`,
    [input.instanceId, input.accountId, input.strategy]
  );
};
