import {
  resolveExpectedGooseMigrationFromDirectory,
  runIamDatabaseReadinessForConnection,
} from '@sva/auth-runtime/schema-guard';

const requiredEnvironmentValue = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Pflichtvariable fehlt: ${name}`);
  }
  return value;
};

const parsePort = (value) => {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('POSTGRES_PORT ist ungültig.');
  }
  return port;
};

const buildClientConfig = () => {
  const connectionString = process.env.IAM_DATABASE_URL?.trim();
  if (connectionString) {
    return { connectionString };
  }

  // One-shot migration, bootstrap and provisioning jobs intentionally use the
  // database owner here. The app path always supplies IAM_DATABASE_URL for sva_app.
  return {
    database: requiredEnvironmentValue('POSTGRES_DB'),
    host: process.env.POSTGRES_HOST?.trim() || 'postgres',
    password: requiredEnvironmentValue('POSTGRES_PASSWORD'),
    port: parsePort(process.env.POSTGRES_PORT?.trim() || '5432'),
    user: process.env.POSTGRES_USER?.trim() || 'sva',
  };
};

const errorMetadata = (error) => {
  if (!error || typeof error !== 'object') {
    return { errorType: 'unknown' };
  }
  return {
    errorType: error instanceof Error ? error.name : 'unknown',
    ...('code' in error && typeof error.code === 'string' ? { errorCode: error.code } : {}),
  };
};

try {
  const migrationsDirectory =
    process.env.MIGRATIONS_DIR?.trim() || process.env.SVA_MIGRATIONS_DIR?.trim();
  const expectedMigration = migrationsDirectory
    ? resolveExpectedGooseMigrationFromDirectory(migrationsDirectory)
    : resolveExpectedGooseMigrationFromDirectory();
  const readiness = await runIamDatabaseReadinessForConnection(
    buildClientConfig(),
    expectedMigration
  );
  const failedSchemaObjects = readiness.schema.checks
    .filter((check) => !check.ok)
    .map(({ expectedMigration: migration, reasonCode, schemaObject }) => ({
      expectedMigration: migration,
      reasonCode,
      schemaObject,
    }));
  const result = {
    appliedMigrationVersion: readiness.migration.appliedVersion,
    expectedMigration: readiness.migration.expectedMigration,
    expectedMigrationVersion: readiness.migration.expectedVersion,
    failedSchemaObjects,
    ok: readiness.ok,
    reasonCode: !readiness.migration.ok
      ? 'migration_drift'
      : !readiness.schema.ok
        ? 'schema_drift'
        : undefined,
  };

  if (!readiness.ok) {
    process.stderr.write(`[iam-schema-readiness] failed ${JSON.stringify(result)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`[iam-schema-readiness] ready ${JSON.stringify(result)}\n`);
  }
} catch (error) {
  process.stderr.write(
    `[iam-schema-readiness] check_failed ${JSON.stringify(errorMetadata(error))}\n`
  );
  process.exitCode = 1;
}
