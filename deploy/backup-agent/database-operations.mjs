import { runtimePrincipalProbeSql, validateRuntimePrincipalProbe } from './principal-probes.mjs';
import {
  sqlIdentifier,
  sqlLiteral,
  assertRuntimePrincipalTarget,
  buildRuntimePrincipalReconciliationSql,
} from './principal-reconciliation.mjs';
import { targets, postgresIdentifierPattern, deriveWasteDatabaseName } from './runtime-config.mjs';
import { readSecret, runCapture, runSql } from './runtime-io.mjs';
import { validTenantInstanceId } from './request-validation.mjs';

export const parseWasteInventory = (value) => {
  let rows;
  try {
    rows = JSON.parse(value);
  } catch {
    throw new Error('waste_inventory_invalid');
  }
  if (!Array.isArray(rows)) throw new Error('waste_inventory_invalid');
  return rows.map((row) => {
    if (
      !row ||
      typeof row !== 'object' ||
      !validTenantInstanceId(row.instanceId) ||
      !postgresIdentifierPattern.test(row.databaseName) ||
      row.databaseName !== deriveWasteDatabaseName(row.instanceId) ||
      !['ready', 'disabled'].includes(row.status)
    )
      throw new Error('waste_inventory_invalid');
    return {
      instanceId: row.instanceId,
      databaseName: row.databaseName,
      status: row.status,
    };
  });
};

export const discoverWasteInventory = async (environment, tenantInstanceId) => {
  const target = targets[environment];
  if (!target || (tenantInstanceId !== undefined && !validTenantInstanceId(tenantInstanceId)))
    throw new Error('waste_inventory_request_invalid');
  const tenantFilter = tenantInstanceId ? `AND instance_id = ${sqlLiteral(tenantInstanceId)}` : '';
  const sql = `
SELECT COALESCE(json_agg(json_build_object(
  'instanceId', instance_id,
  'databaseName', database_name,
  'status', status
) ORDER BY instance_id), '[]'::json)
FROM iam.instance_waste_provisioning
WHERE status IN ('ready', 'disabled')
  AND database_name IS NOT NULL
  ${tenantFilter};`;
  const output = await runCapture(
    'psql',
    [
      '--host',
      target.postgresHost,
      '--port',
      '5432',
      '--username',
      target.postgresUser,
      '--dbname',
      target.postgresDatabase,
      '--no-psqlrc',
      '--tuples-only',
      '--no-align',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      sql,
    ],
    {
      env: {
        ...process.env,
        PGCONNECT_TIMEOUT: '10',
        PGPASSWORD: await readSecret(target.postgresPasswordFile),
      },
      maxOutputBytes: 1024 * 1024,
    }
  );
  const inventory = parseWasteInventory(output);
  if (tenantInstanceId && inventory.length !== 1)
    throw new Error('waste_inventory_tenant_not_found');
  return inventory;
};

export const reconcileAndProbeRuntimePrincipal = async (target, pgEnv) => {
  try {
    await runSql(target, pgEnv, buildRuntimePrincipalReconciliationSql(target));
  } catch {
    throw new Error('runtime_principal_reconciliation_failed');
  }
  try {
    const output = await runSql(target, pgEnv, runtimePrincipalProbeSql(target));
    const payload = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    return validateRuntimePrincipalProbe(JSON.parse(payload ?? 'null'));
  } catch (error) {
    if (error instanceof Error && error.message === 'runtime_principal_probe_failed') throw error;
    throw new Error('runtime_principal_probe_failed', { cause: error });
  }
};

export const runSqlAsSchemaOwner = async (target, pgEnv, sql) => {
  const output = await runSql(
    target,
    pgEnv,
    `SET ROLE ${sqlIdentifier(target.schemaOwner)}; ${sql}`
  );
  return (
    output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1) ?? ''
  );
};

export const waitForSessionDrain = async (
  target,
  pgEnv,
  {
    attempts = 30,
    readActiveSessions = () =>
      runSql(
        target,
        pgEnv,
        `SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND usename = ANY(ARRAY[${sqlLiteral(target.runtimeUser)}${target.publicRuntimeUser ? `, ${sqlLiteral(target.publicRuntimeUser)}` : ''}]) AND backend_type = 'client backend' AND pid <> pg_backend_pid()`
      ),
    wait = () => new Promise((resolveWait) => setTimeout(resolveWait, 2_000)),
  } = {}
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const activeSessions = Number(await readActiveSessions());
    if (Number.isInteger(activeSessions) && activeSessions === 0) return;
    if (attempt < attempts - 1) await wait();
  }
  throw new Error('active_app_sessions');
};

export const ensureWasteRestoreDatabase = async (environment, target, pgEnv) => {
  assertRuntimePrincipalTarget(target);
  if (target.database !== 'waste' || !target.postgresDatabase.endsWith('_restore'))
    throw new Error('waste_restore_target_invalid');
  const centralTarget = targets[environment];
  const database = sqlIdentifier(target.postgresDatabase);
  const owner = sqlIdentifier(target.schemaOwner);
  const login = sqlIdentifier(target.restoreUser);
  const centralArgs = [
    '--host',
    centralTarget.postgresHost,
    '--port',
    '5432',
    '--username',
    target.restoreUser,
    '--dbname',
    centralTarget.postgresDatabase,
    '--no-psqlrc',
    '--tuples-only',
    '--no-align',
    '--set',
    'ON_ERROR_STOP=1',
  ];
  const exists = await runCapture(
    'psql',
    [
      ...centralArgs,
      '--command',
      `SELECT 1 FROM pg_database WHERE datname = ${sqlLiteral(target.postgresDatabase)}`,
    ],
    { env: pgEnv }
  );
  if (exists !== '1') {
    await runCapture(
      'psql',
      [...centralArgs, '--command', `CREATE DATABASE ${database} OWNER ${owner}`],
      { env: pgEnv }
    );
  }
  const sql = `DO $restore_database_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_database database
    JOIN pg_roles owner_role ON owner_role.oid = database.datdba
    WHERE database.datname = ${sqlLiteral(target.postgresDatabase)}
      AND owner_role.rolname = ${sqlLiteral(target.schemaOwner)}
  ) THEN
    RAISE EXCEPTION 'waste_restore_database_owner_invalid';
  END IF;
END
$restore_database_guard$;
REVOKE ALL ON DATABASE ${database} FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE ${database} TO ${owner}, ${login};`;
  await runCapture('psql', [...centralArgs, '--command', sql], { env: pgEnv });
};
