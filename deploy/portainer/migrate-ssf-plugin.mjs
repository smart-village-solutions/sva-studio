import { spawnSync } from 'node:child_process';

const identifierPattern = /^[a-z][a-z0-9_]{0,62}$/u;

const required = (value, name) => {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name}_missing`);
  return normalized;
};

const identifier = (value, name) => {
  const normalized = required(value, name);
  if (!identifierPattern.test(normalized)) throw new Error(`${name}_invalid`);
  return normalized;
};

const sqlIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const sqlLiteral = (value) => `'${value.replaceAll("'", "''")}'`;

const postgresHost = process.env.POSTGRES_HOST || 'postgres';
const postgresPort = process.env.POSTGRES_PORT || '5432';
const postgresUser = identifier(process.env.POSTGRES_USER, 'POSTGRES_USER');
const postgresPassword = required(process.env.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD');
const targetDatabase = identifier(
  process.env.SSF_PLUGIN_DATABASE_NAME || 'sva_studio_ssf',
  'SSF_PLUGIN_DATABASE_NAME'
);

const runPsql = (database, sql) => {
  const result = spawnSync(
    'psql',
    [
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
      '-h',
      postgresHost,
      '-p',
      postgresPort,
      '-U',
      postgresUser,
      '-d',
      database,
      '-c',
      sql,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: postgresPassword },
      stdio: ['ignore', 'pipe', 'inherit'],
    }
  );
  if (result.status !== 0) throw new Error('ssf_psql_failed');
  return result.stdout.trim();
};

const prepare = () => {
  const adminDatabase = identifier(process.env.POSTGRES_DB, 'POSTGRES_DB');
  const exists = runPsql(
    adminDatabase,
    `SELECT 1 FROM pg_database WHERE datname = ${sqlLiteral(targetDatabase)}`
  );
  if (!exists) runPsql(adminDatabase, `CREATE DATABASE ${sqlIdentifier(targetDatabase)}`);
};

const reconcile = () => {
  const login = identifier(
    process.env.SSF_PLUGIN_RUNTIME_DB_USER || 'sva_ssf_runtime',
    'SSF_PLUGIN_RUNTIME_DB_USER'
  );
  const password = required(
    process.env.SSF_PLUGIN_RUNTIME_DB_PASSWORD,
    'SSF_PLUGIN_RUNTIME_DB_PASSWORD'
  );
  runPsql(
    targetDatabase,
    `DO $ssf_runtime_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(login)}) THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
      ${sqlLiteral(login)},
      ${sqlLiteral(password)}
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
      ${sqlLiteral(login)},
      ${sqlLiteral(password)}
    );
  END IF;
END
$ssf_runtime_role$;
GRANT ssf_plugin_tenant_runtime TO ${sqlIdentifier(login)} WITH INHERIT FALSE;
REVOKE CONNECT ON DATABASE ${sqlIdentifier(targetDatabase)} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${sqlIdentifier(targetDatabase)} TO ${sqlIdentifier(login)};`
  );
};

const mode = process.argv[2];
if (mode === 'prepare') prepare();
else if (mode === 'reconcile') reconcile();
else throw new Error('ssf_migration_mode_invalid');
