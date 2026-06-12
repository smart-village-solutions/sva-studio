import type { AuditCheckResult } from './model.ts';
import type { createStudioRemoteSqlClient } from './remote-sql.ts';
import { sqlLiteral } from './remote-sql.ts';

type RemoteSqlClient = ReturnType<typeof createStudioRemoteSqlClient>;
type CountRow = Readonly<{ count: number }>;

export const inspectLocalStudioIam = async (
  client: Pick<RemoteSqlClient, 'queryOne'>,
  instanceId: string,
): Promise<{ checks: readonly AuditCheckResult[] }> => {
  const row = await client.queryOne<CountRow>(`
SELECT COUNT(*)::int AS count
FROM iam.account_roles ar
JOIN iam.roles r ON r.id = ar.role_id
WHERE ar.instance_id = ${sqlLiteral(instanceId)}
  AND r.role_key = 'system_admin'
  AND ar.valid_from <= NOW()
  AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
`);

  const count = row?.count ?? 0;

  return {
    checks: [
      {
        checkId: 'local_iam.system_admin.exists',
        details: { count },
        status: count > 0 ? 'pass' : 'fail',
        summary: `${count} aktive lokale system_admin-Zuweisungen`,
        title: 'Lokaler system_admin existiert',
      },
    ],
  };
};
