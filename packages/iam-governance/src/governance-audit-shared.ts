import { createHash } from 'node:crypto';

import type { QueryClient } from './query-client.js';

export const pseudonymizeGovernanceSubject = (value: string) =>
  createHash('sha256').update(value).digest('hex').slice(0, 16);

export const resolveGovernanceAccountId = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<string | undefined> => {
  const lookup = await client.query<{ id: string }>(
    `
SELECT a.id
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );

  if (lookup.rowCount <= 0) {
    return undefined;
  }

  return lookup.rows[0]?.id;
};
