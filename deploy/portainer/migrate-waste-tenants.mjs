import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const identifierPattern = /^[a-z][a-z0-9_]{0,62}$/u;
const migrationIdPattern = /^\d{8}_\d{2}_[a-z0-9_]+$/u;
const migrationLedgerTable = 'public.sva_waste_schema_migrations';

export const wasteTenantMigrations = Object.freeze([
  Object.freeze({
    id: '20260816_01_add_waste_city_postal_code',
    statements: Object.freeze([
      'ALTER TABLE public.waste_cities ADD COLUMN IF NOT EXISTS postal_code TEXT;',
    ]),
    verification: Object.freeze({
      sql: `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
            AND column_name = $3
        ) AS satisfied;
      `,
      values: Object.freeze(['public', 'waste_cities', 'postal_code']),
    }),
  }),
  Object.freeze({
    id: '20260816_02_tour_date_shift_date_contract',
    statements: Object.freeze([
      `DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM public.waste_tour_date_shifts LIMIT 1) THEN
          RAISE EXCEPTION 'waste_migration_tour_date_shift_data_present';
        END IF;
      END $$;`,
      'ALTER TABLE public.waste_tour_date_shifts ALTER COLUMN original_date TYPE DATE USING original_date::date;',
      'ALTER TABLE public.waste_tour_date_shifts ALTER COLUMN actual_date TYPE DATE USING actual_date::date;',
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_waste_tour_date_shifts_specific_origin ON public.waste_tour_date_shifts(tour_id, original_date) WHERE has_year;',
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_waste_tour_date_shifts_annual_origin ON public.waste_tour_date_shifts(tour_id, (EXTRACT(MONTH FROM original_date)), (EXTRACT(DAY FROM original_date))) WHERE NOT has_year;',
    ]),
    verification: Object.freeze({
      sql: `
        WITH date_columns AS (
          SELECT COUNT(*) = 2 AS satisfied
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'waste_tour_date_shifts'
            AND column_name IN ('original_date', 'actual_date')
            AND data_type = 'date'
        ), index_contracts AS (
          SELECT
            index_class.relname AS index_name,
            index_definition.indisunique,
            index_definition.indnkeyatts,
            pg_get_indexdef(index_definition.indexrelid, 1, TRUE) AS first_key,
            pg_get_indexdef(index_definition.indexrelid, 2, TRUE) AS second_key,
            pg_get_indexdef(index_definition.indexrelid, 3, TRUE) AS third_key,
            pg_get_expr(index_definition.indpred, index_definition.indrelid, TRUE) AS predicate
          FROM pg_index AS index_definition
          INNER JOIN pg_class AS table_class
            ON table_class.oid = index_definition.indrelid
          INNER JOIN pg_namespace AS table_namespace
            ON table_namespace.oid = table_class.relnamespace
          INNER JOIN pg_class AS index_class
            ON index_class.oid = index_definition.indexrelid
          WHERE table_namespace.nspname = 'public'
            AND table_class.relname = 'waste_tour_date_shifts'
            AND index_class.relname IN (
              'uq_waste_tour_date_shifts_specific_origin',
              'uq_waste_tour_date_shifts_annual_origin'
            )
        )
        SELECT
          (SELECT satisfied FROM date_columns)
          AND COALESCE((
            SELECT indisunique
              AND indnkeyatts = 2
              AND first_key = 'tour_id'
              AND second_key = 'original_date'
              AND regexp_replace(lower(predicate), '[[:space:]()]', '', 'g') = 'has_year'
            FROM index_contracts
            WHERE index_name = 'uq_waste_tour_date_shifts_specific_origin'
          ), FALSE)
          AND COALESCE((
            SELECT indisunique
              AND indnkeyatts = 3
              AND first_key = 'tour_id'
              AND regexp_replace(lower(second_key), '[[:space:]()]', '', 'g') =
                'extract(monthfromoriginal_date)'
              AND regexp_replace(lower(third_key), '[[:space:]()]', '', 'g') =
                'extract(dayfromoriginal_date)'
              AND regexp_replace(lower(predicate), '[[:space:]()]', '', 'g') = 'nothas_year'
            FROM index_contracts
            WHERE index_name = 'uq_waste_tour_date_shifts_annual_origin'
          ), FALSE)
          AS satisfied;
      `,
      values: Object.freeze([]),
    }),
  }),
]);

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`waste_migration_required_config_missing:${name}`);
  return value;
};

export const parseDatabasePort = (value, errorCode) => {
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error(errorCode);
  return port;
};

const quoteIdentifier = (value) => {
  if (!identifierPattern.test(value)) throw new Error('waste_migration_identifier_invalid');
  return `"${value}"`;
};

export const validateWasteTenantMigrations = (migrations) => {
  if (!Array.isArray(migrations) || migrations.length === 0) {
    throw new Error('waste_migration_catalog_empty');
  }
  const migrationIds = new Set();
  for (const migration of migrations) {
    if (!migrationIdPattern.test(migration?.id ?? '') || migrationIds.has(migration.id)) {
      throw new Error('waste_migration_catalog_id_invalid');
    }
    if (
      !Array.isArray(migration.statements) ||
      migration.statements.length === 0 ||
      migration.statements.some(
        (statement) => typeof statement !== 'string' || !statement.trim()
      ) ||
      typeof migration.verification?.sql !== 'string' ||
      !migration.verification.sql.trim() ||
      !Array.isArray(migration.verification.values)
    ) {
      throw new Error(`waste_migration_catalog_entry_invalid:${migration.id}`);
    }
    migrationIds.add(migration.id);
  }
  return migrations;
};

const verifyMigration = async (client, migration) => {
  const verification = await client.query(
    migration.verification.sql,
    migration.verification.values
  );
  if (verification.rows[0]?.satisfied !== true) {
    throw new Error(`waste_migration_verification_failed:${migration.id}`);
  }
};

export const migrateWasteTenantDatabase = async ({
  appRole,
  client,
  migrations,
  ownerRole,
  publicAppRole,
}) => {
  let transactionStarted = false;
  try {
    await client.query('BEGIN;');
    transactionStarted = true;
    await client.query("SET LOCAL lock_timeout = '5s';");
    await client.query("SET LOCAL statement_timeout = '15min';");
    await client.query(`SET LOCAL ROLE ${quoteIdentifier(ownerRole)};`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${migrationLedgerTable} (
        migration_id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`REVOKE ALL PRIVILEGES ON TABLE ${migrationLedgerTable} FROM PUBLIC;`);
    await client.query(
      `REVOKE ALL PRIVILEGES ON TABLE ${migrationLedgerTable} FROM ${quoteIdentifier(appRole)}, ${quoteIdentifier(publicAppRole)};`
    );

    const applied = await client.query(
      `SELECT migration_id FROM ${migrationLedgerTable} ORDER BY migration_id ASC;`
    );
    const appliedMigrationIds = new Set(applied.rows.map((row) => row.migration_id));
    let appliedMigrationCount = 0;

    for (const migration of migrations) {
      if (!appliedMigrationIds.has(migration.id)) {
        for (const statement of migration.statements) await client.query(statement);
        await verifyMigration(client, migration);
        await client.query(`INSERT INTO ${migrationLedgerTable} (migration_id) VALUES ($1);`, [
          migration.id,
        ]);
        appliedMigrationCount += 1;
      } else {
        await verifyMigration(client, migration);
      }
    }

    await client.query('COMMIT;');
    transactionStarted = false;
    return { appliedMigrationCount };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK;');
      } catch (rollbackError) {
        throw new AggregateError([error], 'waste_migration_rollback_failed', {
          cause: rollbackError,
        });
      }
    }
    throw error;
  }
};

export const migrateWasteTenantDatabases = async ({
  adminClient,
  connectTenant,
  deriveNames,
  migrations = wasteTenantMigrations,
}) => {
  validateWasteTenantMigrations(migrations);
  let inventoryLockHeld = false;
  try {
    await adminClient.query('BEGIN;');
    inventoryLockHeld = true;
    await adminClient.query("SET LOCAL lock_timeout = '30s';");
    await adminClient.query('LOCK TABLE iam.instance_waste_provisioning IN SHARE MODE;');
    const inventory = await adminClient.query(
      `
      SELECT instance_id, database_name, status
      FROM iam.instance_waste_provisioning
      WHERE status = ANY($1::text[])
      ORDER BY instance_id ASC;
    `,
      [['ready', 'disabled', 'provisioning']]
    );
    if (inventory.rows.some((row) => row.status === 'provisioning')) {
      throw new Error('waste_migration_provisioning_in_progress');
    }

    let appliedMigrationCount = 0;
    let migratedTenantCount = 0;
    for (const row of inventory.rows) {
      const names = deriveNames(row.instance_id);
      if (row.database_name !== names.database) {
        throw new Error('waste_migration_registry_database_mismatch');
      }
      const tenantClient = await connectTenant(names.database);
      try {
        const result = await migrateWasteTenantDatabase({
          appRole: names.appRole,
          client: tenantClient,
          migrations,
          ownerRole: names.ownerRole,
          publicAppRole: names.publicAppRole,
        });
        appliedMigrationCount += result.appliedMigrationCount;
        migratedTenantCount += 1;
      } finally {
        await tenantClient.end();
      }
    }
    await adminClient.query('COMMIT;');
    inventoryLockHeld = false;
    return { appliedMigrationCount, migratedTenantCount, status: 'ok' };
  } catch (error) {
    if (inventoryLockHeld) await adminClient.query('ROLLBACK;');
    throw error;
  }
};

export const isWasteMigrationEntrypoint = (moduleUrl, executablePath) =>
  Boolean(executablePath) && moduleUrl === pathToFileURL(resolve(executablePath)).href;

export const runWasteTenantMigrations = async () => {
  const [{ default: pg }, { deriveWasteTenantDatabaseNames }] = await Promise.all([
    import('pg'),
    import('@sva/server-runtime'),
  ]);
  const { Client } = pg;
  const passwordFile = required('WASTE_DATABASE_PROVISIONER_PASSWORD_FILE');
  const provisionerPassword = (await readFile(passwordFile, 'utf8')).trim();
  if (!provisionerPassword) throw new Error('waste_migration_provisioner_password_empty');
  const port = parseDatabasePort(
    required('POSTGRES_PORT'),
    'waste_migration_postgres_port_invalid'
  );
  const provisionerPort = parseDatabasePort(
    process.env.WASTE_DATABASE_PROVISIONER_PORT?.trim() || port,
    'waste_migration_provisioner_port_invalid'
  );
  const host = required('POSTGRES_HOST');
  const adminClient = new Client({
    database: required('POSTGRES_DB'),
    host,
    password: required('POSTGRES_PASSWORD'),
    port,
    user: required('POSTGRES_USER'),
  });
  await adminClient.connect();
  try {
    return await migrateWasteTenantDatabases({
      adminClient,
      connectTenant: async (database) => {
        const client = new Client({
          database,
          host: process.env.WASTE_DATABASE_PROVISIONER_HOST?.trim() || host,
          password: provisionerPassword,
          port: provisionerPort,
          user: required('WASTE_DATABASE_PROVISIONER_USER'),
        });
        await client.connect();
        return client;
      },
      deriveNames: deriveWasteTenantDatabaseNames,
    });
  } finally {
    await adminClient.end();
  }
};

if (isWasteMigrationEntrypoint(import.meta.url, process.argv[1])) {
  runWasteTenantMigrations()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'waste_migration_internal_error';
      const code = message.startsWith('waste_migration_')
        ? message.split(':', 1)[0].toUpperCase()
        : 'WASTE_MIGRATION_INTERNAL_ERROR';
      process.stderr.write(
        `${JSON.stringify({ code, phase: 'waste-tenant-migration', retryable: false })}\n`
      );
      process.exitCode = 1;
    });
}
