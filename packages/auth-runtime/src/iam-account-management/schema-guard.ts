import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, type ClientConfig } from 'pg';

import type { QueryClient } from '../db.js';
import { REQUIRED_SCHEMA_CHECKS, type SchemaGuardRow } from './schema-guard-checks.js';
import {
  CRITICAL_IAM_SCHEMA_GUARD_SQL,
  GRAPHILE_WORKER_READINESS_FIELDS,
  GRAPHILE_WORKER_READINESS_SQL,
} from './schema-guard-sql.js';

export { CRITICAL_IAM_SCHEMA_GUARD_FIELDS } from './schema-guard-checks.js';
export { CRITICAL_IAM_SCHEMA_GUARD_SQL } from './schema-guard-sql.js';

export type SchemaGuardCheckKind = 'column' | 'index' | 'policy' | 'table';

export type SchemaGuardCheck = {
  readonly expectedMigration?: string;
  readonly kind: SchemaGuardCheckKind;
  readonly message: string;
  readonly ok: boolean;
  readonly reasonCode:
    'missing_column' | 'missing_index' | 'missing_policy' | 'missing_table' | 'policy_mismatch';
  readonly schemaObject: string;
};

export type SchemaGuardReport = {
  readonly checks: readonly SchemaGuardCheck[];
  readonly ok: boolean;
};

export type ExpectedGooseMigration = {
  readonly fileName: string;
  readonly version: number;
};

export type MigrationReadinessReport = {
  readonly appliedVersion: number | null;
  readonly expectedMigration: string;
  readonly expectedVersion: number;
  readonly ok: boolean;
  readonly reasonCode?: 'migration_drift';
};

export type IamDatabaseReadinessReport = {
  readonly migration: MigrationReadinessReport;
  readonly ok: boolean;
  readonly schema: SchemaGuardReport;
};

export type GraphileWorkerReadinessReport = {
  readonly failedChecks: readonly string[];
  readonly ok: boolean;
};

const GOOSE_MIGRATION_FILE_PATTERN = /^(\d+)_.*\.sql$/u;
const DEFAULT_MIGRATIONS_DIRECTORY = 'packages/data/migrations';
const expectedMigrationByDirectory = new Map<string, ExpectedGooseMigration>();

export const resolveExpectedGooseMigration = (
  fileNames: readonly string[]
): ExpectedGooseMigration => {
  const migrations = fileNames
    .filter((fileName) => fileName.endsWith('.sql'))
    .map((fileName) => {
      const match = GOOSE_MIGRATION_FILE_PATTERN.exec(fileName);
      const version = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;
      if (!Number.isInteger(version)) {
        throw new Error(`Migration ${fileName} hat keinen gueltigen numerischen Versionspraefix.`);
      }
      return { fileName, version };
    })
    .sort(
      (left, right) => left.version - right.version || left.fileName.localeCompare(right.fileName)
    );

  const expected = migrations[migrations.length - 1];
  if (!expected) {
    throw new Error('Keine Goose-Migrationen fuer den Runtime-Sollstand gefunden.');
  }
  const duplicateVersion = migrations.find(
    (migration, index) => index > 0 && migrations[index - 1]?.version === migration.version
  );
  if (duplicateVersion) {
    throw new Error(`Goose-Migrationsversion ${duplicateVersion.version} ist nicht eindeutig.`);
  }
  return expected;
};

export const resolveIamMigrationsDirectory = (
  environment: NodeJS.ProcessEnv = process.env
): string =>
  environment.MIGRATIONS_DIR?.trim() ||
  environment.SVA_MIGRATIONS_DIR?.trim() ||
  DEFAULT_MIGRATIONS_DIRECTORY;

export const resolveExpectedGooseMigrationFromDirectory = (
  migrationsDirectory = resolveIamMigrationsDirectory()
): ExpectedGooseMigration => {
  const resolvedMigrationsDirectory = resolve(migrationsDirectory);
  const cachedMigration = expectedMigrationByDirectory.get(resolvedMigrationsDirectory);
  if (cachedMigration) {
    return cachedMigration;
  }

  const expectedMigration = resolveExpectedGooseMigration(
    readdirSync(resolvedMigrationsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
  );
  expectedMigrationByDirectory.set(resolvedMigrationsDirectory, expectedMigration);
  return expectedMigration;
};

export const buildIamDatabaseReadinessSql = (): string => {
  const schemaGuardSql = CRITICAL_IAM_SCHEMA_GUARD_SQL.trim().replace(/;$/u, '');
  return `
SELECT
  checks.*,
  (
    SELECT MAX(version_id)::text
    FROM public.goose_db_version
    WHERE is_applied = true
  ) AS current_migration_version
FROM (
${schemaGuardSql}
) checks;
`;
};

const toBoolean = (value: unknown) =>
  value === true || value === 't' || value === 'true' || value === 1;

export const evaluateCriticalIamSchemaGuard = (row: Record<string, unknown>): SchemaGuardReport => {
  const checks = REQUIRED_SCHEMA_CHECKS.map((definition) => ({
    kind: definition.kind,
    schemaObject: definition.schemaObject,
    reasonCode: definition.reasonCode,
    expectedMigration: definition.expectedMigration,
    message: definition.message,
    ok: toBoolean(row[definition.field]),
  }));

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
};

export const evaluateIamDatabaseReadiness = (
  row: Record<string, unknown>,
  expectedMigration: ExpectedGooseMigration
): IamDatabaseReadinessReport => {
  const schema = evaluateCriticalIamSchemaGuard(row);
  const rawAppliedVersion = row.current_migration_version;
  const parsedAppliedVersion =
    typeof rawAppliedVersion === 'number'
      ? rawAppliedVersion
      : typeof rawAppliedVersion === 'string'
        ? Number.parseInt(rawAppliedVersion, 10)
        : Number.NaN;
  const appliedVersion = Number.isInteger(parsedAppliedVersion) ? parsedAppliedVersion : null;
  const migrationOk = appliedVersion !== null && appliedVersion >= expectedMigration.version;
  const migration: MigrationReadinessReport = {
    appliedVersion,
    expectedMigration: expectedMigration.fileName,
    expectedVersion: expectedMigration.version,
    ok: migrationOk,
    ...(migrationOk ? {} : { reasonCode: 'migration_drift' as const }),
  };

  return {
    migration,
    ok: migration.ok && schema.ok,
    schema,
  };
};

export const runCriticalIamSchemaGuard = async (
  client: QueryClient
): Promise<SchemaGuardReport> => {
  const result = await client.query<SchemaGuardRow>(CRITICAL_IAM_SCHEMA_GUARD_SQL);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return evaluateCriticalIamSchemaGuard(row ?? {});
};

export const runIamDatabaseReadiness = async (
  client: QueryClient,
  expectedMigration: ExpectedGooseMigration
): Promise<IamDatabaseReadinessReport> => {
  const result = await client.query<SchemaGuardRow & { current_migration_version: string | null }>(
    buildIamDatabaseReadinessSql()
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return evaluateIamDatabaseReadiness(row ?? {}, expectedMigration);
};

export const runIamDatabaseReadinessForConnection = async (
  config: ClientConfig,
  expectedMigration: ExpectedGooseMigration
): Promise<IamDatabaseReadinessReport> => {
  const client = new Client(config);
  try {
    await client.connect();
    return await runIamDatabaseReadiness(client as QueryClient, expectedMigration);
  } finally {
    await client.end().catch(() => undefined);
  }
};

export const runGraphileWorkerReadinessForConnection = async (
  config: ClientConfig,
  effectiveAppRole: string,
  appDbUser: string,
  workerDbUser: string
): Promise<GraphileWorkerReadinessReport> => {
  const client = new Client(config);
  try {
    await client.connect();
    const result = await client.query<Record<string, unknown>>(GRAPHILE_WORKER_READINESS_SQL, [
      effectiveAppRole,
      appDbUser,
      workerDbUser,
    ]);
    const row = result.rows[0] ?? {};
    const failedChecks = GRAPHILE_WORKER_READINESS_FIELDS.filter((field) => !toBoolean(row[field]));
    return { failedChecks, ok: failedChecks.length === 0 };
  } finally {
    await client.end().catch(() => undefined);
  }
};

export const summarizeSchemaGuardFailures = (report: SchemaGuardReport): string | undefined => {
  const failed = report.checks.filter((check) => !check.ok);
  if (failed.length === 0) {
    return undefined;
  }

  return failed.map((check) => `${check.reasonCode}:${check.schemaObject}`).join(', ');
};
