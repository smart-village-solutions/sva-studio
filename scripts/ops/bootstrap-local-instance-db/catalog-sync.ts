import type { CliOptions } from './parse-options.js';
import type { ShellRunner } from './docker-psql.js';
import { sqlLiteral } from './docker-psql.js';
import type { LogStep } from './logging.js';
import { loadSourceInstanceMetadata } from './source-instance.js';
import type { DockerPsqlQuiet } from './docker-psql.js';

export const syncCatalog = (
  options: CliOptions,
  deps: {
    readonly dockerPsqlQuiet: DockerPsqlQuiet;
    readonly logStep: LogStep;
    readonly run: ShellRunner;
  }
): void => {
  deps.logStep(`Synchronisiere Basiskatalog von ${options.sourceInstanceId} nach ${options.targetInstanceId}`);
  const metadata = loadSourceInstanceMetadata(options, deps.dockerPsqlQuiet);
  const catalogDump = deps.run('docker', [
    'exec',
    '-i',
    options.sourceDbContainer,
    'pg_dump',
    '-U',
    options.sourceDbUser,
    '--data-only',
    '--inserts',
    '--column-inserts',
    '--table=iam.organizations',
    '--table=iam.roles',
    '--table=iam.permissions',
    '--table=iam.role_permissions',
    options.sourceDbName,
  ]);

  const sourceLiteral = new RegExp(sqlLiteral(options.sourceInstanceId).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'gu');
  const targetLiteral = sqlLiteral(options.targetInstanceId);
  const rewrittenDump = catalogDump.replace(sourceLiteral, targetLiteral);

  const cleanupAndUpsert = `
BEGIN;
DELETE FROM iam.role_permissions WHERE instance_id = ${targetLiteral};
DELETE FROM iam.permissions WHERE instance_id = ${targetLiteral};
DELETE FROM iam.roles WHERE instance_id = ${targetLiteral};
DELETE FROM iam.organizations WHERE instance_id = ${targetLiteral};
INSERT INTO iam.instances (id, display_name, retention_days, audit_retention_days)
VALUES (
  ${targetLiteral},
  ${sqlLiteral(options.targetDisplayName || metadata.displayName)},
  ${Number.isFinite(metadata.retentionDays) ? metadata.retentionDays : 90},
  ${Number.isFinite(metadata.auditRetentionDays) ? metadata.auditRetentionDays : 365}
)
ON CONFLICT (id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    retention_days = EXCLUDED.retention_days,
    audit_retention_days = EXCLUDED.audit_retention_days,
    updated_at = NOW();
COMMIT;
`;

  deps.run(
    'docker',
    [
      'exec',
      '-i',
      options.targetDbContainer,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      options.targetDbUser,
      '-d',
      options.targetDbName,
    ],
    `${cleanupAndUpsert}\n${rewrittenDump}`
  );
};
