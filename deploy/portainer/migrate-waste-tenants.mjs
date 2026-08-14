import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const identifierPattern = /^[a-z][a-z0-9_]{0,62}$/u;

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`waste_migration_required_config_missing:${name}`);
  return value;
};

const quoteIdentifier = (value) => {
  if (!identifierPattern.test(value)) throw new Error('waste_migration_identifier_invalid');
  return `"${value}"`;
};

const requireStringArray = (value, code) => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== 'string' || !entry.trim())
  ) {
    throw new Error(code);
  }
  return value;
};

export const parseWasteSchemaManifest = (source) => {
  const manifest = JSON.parse(source);
  if (manifest?.version !== 1 || manifest.schemaName !== 'public') {
    throw new Error('waste_migration_manifest_version_invalid');
  }
  const rolePlaceholders = manifest.rolePlaceholders;
  for (const key of ['ownerRole', 'appRole', 'publicAppRole']) {
    if (!identifierPattern.test(rolePlaceholders?.[key] ?? '')) {
      throw new Error('waste_migration_manifest_role_placeholder_invalid');
    }
  }
  return {
    ...manifest,
    grantStatements: requireStringArray(
      manifest.grantStatements,
      'waste_migration_manifest_grants_invalid'
    ),
    requiredTables: requireStringArray(
      manifest.requiredTables,
      'waste_migration_manifest_tables_invalid'
    ),
    schemaStatements: requireStringArray(
      manifest.schemaStatements,
      'waste_migration_manifest_schema_invalid'
    ),
  };
};

export const resolveGrantStatements = (manifest, names) => {
  const replacements = Object.entries(manifest.rolePlaceholders).map(([key, placeholder]) => [
    quoteIdentifier(placeholder),
    quoteIdentifier(names[key]),
  ]);
  return manifest.grantStatements.map((statement) =>
    replacements.reduce(
      (resolved, [placeholder, role]) => resolved.replaceAll(placeholder, role),
      statement
    )
  );
};

export const migrateWasteTenantDatabases = async ({
  adminClient,
  connectTenant,
  deriveNames,
  manifest,
}) => {
  const inventory = await adminClient.query(
    `
    SELECT instance_id, database_name, status
    FROM iam.instance_waste_provisioning
    WHERE status = ANY($1::text[])
    ORDER BY instance_id ASC;
  `,
    [['ready', 'disabled']]
  );

  let migratedTenantCount = 0;
  for (const row of inventory.rows) {
    const names = deriveNames(row.instance_id);
    if (row.database_name !== names.database) {
      throw new Error('waste_migration_registry_database_mismatch');
    }
    const tenantClient = await connectTenant(names.database);
    try {
      await tenantClient.query("SET lock_timeout = '5s';");
      await tenantClient.query("SET statement_timeout = '15min';");
      await tenantClient.query(`SET ROLE ${quoteIdentifier(names.ownerRole)};`);
      await tenantClient.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC;');
      await tenantClient.query(`ALTER SCHEMA public OWNER TO ${quoteIdentifier(names.ownerRole)};`);
      for (const statement of manifest.schemaStatements) await tenantClient.query(statement);
      for (const statement of resolveGrantStatements(manifest, names))
        await tenantClient.query(statement);
      const verification = await tenantClient.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = ANY($2::text[]);`,
        [manifest.schemaName, manifest.requiredTables]
      );
      if (
        new Set(verification.rows.map((entry) => entry.table_name)).size !==
        manifest.requiredTables.length
      ) {
        throw new Error('waste_migration_schema_incomplete');
      }
      migratedTenantCount += 1;
    } finally {
      await tenantClient.end();
    }
  }
  return { migratedTenantCount, status: 'ok' };
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
  const port = Number(required('POSTGRES_PORT'));
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('waste_migration_postgres_port_invalid');
  }
  const manifest = parseWasteSchemaManifest(
    await readFile(
      process.env.WASTE_SCHEMA_MANIFEST_PATH?.trim() || './waste-schema-statements.json',
      'utf8'
    )
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
          port: Number(process.env.WASTE_DATABASE_PROVISIONER_PORT?.trim() || port),
          user: required('WASTE_DATABASE_PROVISIONER_USER'),
        });
        await client.connect();
        return client;
      },
      deriveNames: deriveWasteTenantDatabaseNames,
      manifest,
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
