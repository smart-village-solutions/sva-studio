import type { CliOptions } from './parse-options.js';
import type { DockerPsqlQuiet } from './docker-psql.js';
import { sqlLiteral } from './docker-psql.js';

export type InstanceMetadata = {
  auditRetentionDays: number;
  displayName: string;
  retentionDays: number;
};

export const loadSourceInstanceMetadata = (
  options: CliOptions,
  dockerPsqlQuiet: DockerPsqlQuiet
): InstanceMetadata => {
  const raw = dockerPsqlQuiet(
    options.sourceDbContainer,
    options.sourceDbUser,
    options.sourceDbName,
    `SELECT display_name, retention_days, audit_retention_days FROM iam.instances WHERE id = ${sqlLiteral(options.sourceInstanceId)};`
  );

  if (!raw) {
    throw new Error(`Source instance ${options.sourceInstanceId} not found in ${options.sourceDbContainer}`);
  }

  const [displayName, retentionDays, auditRetentionDays] = raw.split('\t');
  return {
    auditRetentionDays: Number.parseInt(auditRetentionDays, 10),
    displayName,
    retentionDays: Number.parseInt(retentionDays, 10),
  };
};
