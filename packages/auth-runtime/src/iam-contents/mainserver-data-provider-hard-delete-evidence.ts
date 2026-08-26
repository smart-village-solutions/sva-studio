import { withInstanceScopedDb } from '../iam-account-management/shared.js';

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

export const loadHardDeleteEvidence = async (
  client: InstanceScopedClient,
  instanceId: string,
  principalIds: readonly string[]
): Promise<ReadonlySet<string>> => {
  const uniquePrincipalIds = [...new Set(principalIds)];
  if (uniquePrincipalIds.length === 0) return new Set();
  const result = await client.query<{ subject_id: string }>(
    `
SELECT DISTINCT subject_id::text
FROM (
  SELECT subject_id, payload FROM iam.activity_logs
  WHERE instance_id = $1 AND event_type = 'user.deleted' AND result = 'success'
  UNION ALL
  SELECT subject_id, payload FROM iam.activity_logs_archive
  WHERE instance_id = $1 AND event_type = 'user.deleted' AND result = 'success'
) deletion_evidence
WHERE subject_id = ANY($2::uuid[])
  AND payload ->> 'deleted_account_id' = subject_id::text;
`,
    [instanceId, uniquePrincipalIds]
  );
  return new Set(result.rows.map((row) => row.subject_id));
};
