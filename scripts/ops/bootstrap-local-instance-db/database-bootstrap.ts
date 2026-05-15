import type { CliOptions } from './parse-options.js';
import type { DockerPsql, ShellRunner } from './docker-psql.js';
import { sqlIdentifier, sqlLiteral } from './docker-psql.js';
import type { LogStep } from './logging.js';

export const recreateDatabase = (options: CliOptions, run: ShellRunner, logStep: LogStep): void => {
  logStep(`Erzeuge Ziel-Datenbank ${options.targetDbName} in ${options.targetDbContainer}`);
  run('docker', [
    'exec',
    '-i',
    options.targetDbContainer,
    'sh',
    '-lc',
    `dropdb -U ${options.targetDbUser} --if-exists ${options.targetDbName} && createdb -U ${options.targetDbUser} ${options.targetDbName}`,
  ]);
};

export const importSchema = (options: CliOptions, run: ShellRunner, logStep: LogStep): void => {
  logStep(`Importiere Schema aus ${options.sourceDbContainer}:${options.sourceDbName}`);
  const schemaSql = run('docker', [
    'exec',
    '-i',
    options.sourceDbContainer,
    'pg_dump',
    '-U',
    options.sourceDbUser,
    '--schema-only',
    '--no-owner',
    '--no-privileges',
    options.sourceDbName,
  ]);

  run(
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
    schemaSql
  );
};

export const bootstrapAppUser = (options: CliOptions, dockerPsql: DockerPsql, logStep: LogStep): void => {
  logStep(`Bootstrappe App-User ${options.targetAppDbUser} auf ${options.targetDbContainer}`);
  const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iam_app') THEN
    CREATE ROLE iam_app NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(options.targetAppDbUser)}) THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT',
      ${sqlLiteral(options.targetAppDbUser)},
      ${sqlLiteral(options.targetAppDbPassword)}
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE %I WITH LOGIN INHERIT PASSWORD %L',
      ${sqlLiteral(options.targetAppDbUser)},
      ${sqlLiteral(options.targetAppDbPassword)}
    );
  END IF;
END
$$;

GRANT CONNECT, CREATE ON DATABASE ${sqlIdentifier(options.targetDbName)} TO ${sqlIdentifier(options.targetAppDbUser)};
GRANT USAGE, CREATE ON SCHEMA public TO ${sqlIdentifier(options.targetAppDbUser)};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${sqlIdentifier(options.targetAppDbUser)};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${sqlIdentifier(options.targetAppDbUser)};
GRANT iam_app TO ${sqlIdentifier(options.targetAppDbUser)};
GRANT USAGE ON SCHEMA iam TO ${sqlIdentifier(options.targetAppDbUser)};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO ${sqlIdentifier(options.targetAppDbUser)};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO ${sqlIdentifier(options.targetAppDbUser)};
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${sqlIdentifier(options.targetAppDbUser)};
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT USAGE, SELECT ON SEQUENCES TO ${sqlIdentifier(options.targetAppDbUser)};
`;

  dockerPsql(options.targetDbContainer, options.targetDbUser, options.targetDbName, sql);
};
