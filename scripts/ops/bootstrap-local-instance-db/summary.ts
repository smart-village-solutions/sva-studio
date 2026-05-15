import type { CliOptions } from './parse-options.js';
import type { DockerPsqlQuiet } from './docker-psql.js';
import { sqlLiteral } from './docker-psql.js';

export const summarizeTargetState = (
  options: CliOptions,
  dockerPsqlQuiet: DockerPsqlQuiet,
  write: (chunk: string) => void = (chunk) => process.stdout.write(chunk)
): void => {
  const raw = dockerPsqlQuiet(
    options.targetDbContainer,
    options.targetDbUser,
    options.targetDbName,
    `
SELECT 'accounts', COUNT(*)::text FROM iam.accounts WHERE instance_id = ${sqlLiteral(options.targetInstanceId)}
UNION ALL
SELECT 'memberships', COUNT(*)::text FROM iam.instance_memberships WHERE instance_id = ${sqlLiteral(options.targetInstanceId)}
UNION ALL
SELECT 'organizations', COUNT(*)::text FROM iam.organizations WHERE instance_id = ${sqlLiteral(options.targetInstanceId)}
UNION ALL
SELECT 'roles', COUNT(*)::text FROM iam.roles WHERE instance_id = ${sqlLiteral(options.targetInstanceId)}
UNION ALL
SELECT 'permissions', COUNT(*)::text FROM iam.permissions WHERE instance_id = ${sqlLiteral(options.targetInstanceId)};
`
  );

  write('\n==> Zielzustand\n');
  for (const line of raw.split('\n')) {
    const [label, count] = line.split('\t');
    write(`- ${label}: ${count}\n`);
  }
};
