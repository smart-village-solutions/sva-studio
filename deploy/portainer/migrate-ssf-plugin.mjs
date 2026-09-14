import { spawnSync } from 'node:child_process';

import {
  assertDistinctDatabaseNames,
  assertSafeDatabaseLogins,
  resolveDatabasePassword,
} from './ssf-plugin-database-config.mjs';

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
const adminDatabase = identifier(process.env.POSTGRES_DB, 'POSTGRES_DB');
assertDistinctDatabaseNames({ adminDatabase, targetDatabase });

const principalPassword = ({ explicitPassword, connectionString, login, sourceName }) => {
  return resolveDatabasePassword({
    explicitPassword,
    connectionString,
    expectedDatabase: targetDatabase,
    expectedHost: postgresHost,
    expectedPort: postgresPort,
    expectedUser: login,
    name: sourceName,
  });
};

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
      '--file=-',
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: postgresPassword },
      input: sql,
      stdio: ['pipe', 'pipe', 'inherit'],
    }
  );
  if (result.status !== 0) throw new Error('ssf_psql_failed');
  return result.stdout.trim();
};

const prepare = () => {
  const exists = runPsql(
    adminDatabase,
    `SELECT 1 FROM pg_database WHERE datname = ${sqlLiteral(targetDatabase)}`
  );
  if (!exists) runPsql(adminDatabase, `CREATE DATABASE ${sqlIdentifier(targetDatabase)}`);
};

const reconcile = () => {
  const runtimeLogin = identifier(
    process.env.SSF_PLUGIN_RUNTIME_DB_USER || 'sva_ssf_runtime',
    'SSF_PLUGIN_RUNTIME_DB_USER'
  );
  const rootLogin = identifier(
    process.env.SSF_PLUGIN_ROOT_DB_USER || 'sva_ssf_root',
    'SSF_PLUGIN_ROOT_DB_USER'
  );
  assertSafeDatabaseLogins({ postgresUser, rootLogin, runtimeLogin });
  const principals = [
    {
      login: runtimeLogin,
      password: principalPassword({
        explicitPassword: process.env.SSF_PLUGIN_RUNTIME_DB_PASSWORD,
        connectionString: process.env.SVA_STUDIO_SSF_DATABASE_URL,
        login: runtimeLogin,
        sourceName: 'SVA_STUDIO_SSF_DATABASE_URL',
      }),
      forbiddenRole: 'ssf_plugin_root',
      role: 'ssf_plugin_tenant_runtime',
    },
    {
      login: rootLogin,
      password: principalPassword({
        explicitPassword: process.env.SSF_PLUGIN_ROOT_DB_PASSWORD,
        connectionString: process.env.SVA_STUDIO_SSF_ROOT_DATABASE_URL,
        login: rootLogin,
        sourceName: 'SVA_STUDIO_SSF_ROOT_DATABASE_URL',
      }),
      forbiddenRole: 'ssf_plugin_tenant_runtime',
      role: 'ssf_plugin_root',
    },
  ];
  for (const { forbiddenRole, login, password, role } of principals) {
    runPsql(
      targetDatabase,
      `DO $ssf_login_role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(login)}) THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT',
      ${sqlLiteral(login)},
      ${sqlLiteral(password)}
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM pg_auth_members AS membership
      JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
      JOIN pg_roles AS member_role ON member_role.oid = membership.member
      WHERE granted_role.rolname = ${sqlLiteral(role)}
        AND member_role.rolname = ${sqlLiteral(login)}
        AND member_role.rolcanlogin
    ) OR pg_has_role(
      ${sqlLiteral(login)},
      ${sqlLiteral(forbiddenRole)},
      'MEMBER'
    ) THEN
      RAISE EXCEPTION 'existing database login is not owned by its expected SSF role';
    END IF;
    EXECUTE format(
      'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT',
      ${sqlLiteral(login)},
      ${sqlLiteral(password)}
    );
  END IF;
  EXECUTE format(
    'GRANT %I TO %I WITH INHERIT FALSE',
    ${sqlLiteral(role)},
    ${sqlLiteral(login)}
  );
END
$ssf_login_role$;
REVOKE CONNECT ON DATABASE ${sqlIdentifier(targetDatabase)} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${sqlIdentifier(targetDatabase)} TO ${sqlIdentifier(login)};`
    );
  }
};

const mode = process.argv[2];
if (mode === 'prepare') prepare();
else if (mode === 'reconcile') reconcile();
else throw new Error('ssf_migration_mode_invalid');
