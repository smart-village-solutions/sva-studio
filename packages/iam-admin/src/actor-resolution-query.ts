import type { QueryClient } from './query-client.js';

export const resolveActorAccountId = async (
  client: QueryClient,
  input: { readonly instanceId: string; readonly keycloakSubject: string }
): Promise<string | undefined> => {
  const row = await client.query<{ readonly account_id: string }>(
    `
SELECT a.id AS account_id
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );
  return row.rows[0]?.account_id;
};

export const resolveMissingActorDiagnosticReason = async (
  client: QueryClient,
  input: { readonly instanceId: string; readonly keycloakSubject: string }
): Promise<'missing_actor_account' | 'missing_instance_membership'> => {
  const result = await client.query<{
    readonly account_exists: boolean;
    readonly membership_exists: boolean;
  }>(
    `
SELECT
  EXISTS(SELECT 1 FROM iam.accounts WHERE keycloak_subject = $1) AS account_exists,
  EXISTS(
    SELECT 1
    FROM iam.accounts a
    JOIN iam.instance_memberships im
      ON im.account_id = a.id
     AND im.instance_id = $2
    WHERE a.keycloak_subject = $1
  ) AS membership_exists;
`,
    [input.keycloakSubject, input.instanceId]
  );
  const diagnosticRow = result.rows[0];

  if (diagnosticRow?.account_exists) {
    return diagnosticRow.membership_exists ? 'missing_actor_account' : 'missing_instance_membership';
  }

  return 'missing_actor_account';
};
