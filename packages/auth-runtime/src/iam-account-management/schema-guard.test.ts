import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const postgresState = vi.hoisted(() => ({
  connect: vi.fn(),
  end: vi.fn(),
  query: vi.fn(),
}));

vi.mock('pg', () => ({
  Client: class {
    connect = postgresState.connect;
    end = postgresState.end;
    query = postgresState.query;
  },
}));

describe('schema guard helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postgresState.connect.mockResolvedValue(undefined);
    postgresState.end.mockResolvedValue(undefined);
  });

  it('reports canonical Graphile worker readiness and failed checks', async () => {
    const { runGraphileWorkerReadinessForConnection } = await import('./schema-guard.js');
    postgresState.query.mockResolvedValueOnce({
      rows: [
        {
          app_can_enqueue: true,
          app_cannot_create: true,
          graphile_schema_exists: true,
          worker_can_process: true,
          worker_functions_complete: true,
          worker_policies_complete: true,
          worker_role_exists: true,
          worker_sequences_complete: true,
        },
      ],
    });

    await expect(
      runGraphileWorkerReadinessForConnection({}, 'sva_app', 'sva_job_worker')
    ).resolves.toEqual({ failedChecks: [], ok: true });
    expect(postgresState.query).toHaveBeenCalledWith(expect.stringContaining('app_can_enqueue'), [
      'sva_app',
      'sva_job_worker',
    ]);
    expect(postgresState.end).toHaveBeenCalledOnce();

    postgresState.query.mockResolvedValueOnce({ rows: [{ app_can_enqueue: false }] });
    const failed = await runGraphileWorkerReadinessForConnection({}, 'sva_app', 'sva_job_worker');
    expect(failed.ok).toBe(false);
    expect(failed.failedChecks).toContain('app_can_enqueue');
  });

  it('evaluates required checks from boolean-like rows and summarizes failures', async () => {
    const {
      CRITICAL_IAM_SCHEMA_GUARD_FIELDS,
      CRITICAL_IAM_SCHEMA_GUARD_SQL,
      evaluateCriticalIamSchemaGuard,
      summarizeSchemaGuardFailures,
    } = await import('./schema-guard.js');

    expect(CRITICAL_IAM_SCHEMA_GUARD_FIELDS).toContain('groups_exists');
    expect(CRITICAL_IAM_SCHEMA_GUARD_FIELDS).toContain('instance_waste_data_sources_exists');
    expect(CRITICAL_IAM_SCHEMA_GUARD_SQL).toContain("to_regclass('iam.groups')");
    expect(CRITICAL_IAM_SCHEMA_GUARD_SQL).toContain(
      "to_regclass('iam.instance_waste_data_sources')"
    );

    const okRow = Object.fromEntries(
      CRITICAL_IAM_SCHEMA_GUARD_FIELDS.map((field) => [field, true])
    );
    const okReport = evaluateCriticalIamSchemaGuard(okRow);
    expect(okReport.ok).toBe(true);
    expect(okReport.checks.every((check) => check.ok)).toBe(true);
    expect(summarizeSchemaGuardFailures(okReport)).toBeUndefined();

    const failedReport = evaluateCriticalIamSchemaGuard({
      groups_exists: 'false',
      group_roles_exists: 't',
      account_groups_exists: 1,
      accounts_instance_id_column_exists: 0,
    });
    expect(failedReport.ok).toBe(false);
    expect(failedReport.checks.find((check) => check.schemaObject === 'iam.groups')).toMatchObject({
      ok: false,
      reasonCode: 'missing_table',
      expectedMigration: '0014_iam_groups.sql',
    });
    expect(
      failedReport.checks.find((check) => check.schemaObject === 'iam.instance_waste_data_sources')
    ).toMatchObject({
      ok: false,
      reasonCode: 'missing_table',
    });
    expect(summarizeSchemaGuardFailures(failedReport)).toContain('iam.groups');
  });

  it('runs the guard sql through the query client', async () => {
    const { CRITICAL_IAM_SCHEMA_GUARD_SQL, runCriticalIamSchemaGuard } =
      await import('./schema-guard.js');
    const query = vi.fn(async () => ({
      rows: [{ groups_exists: true }],
    }));

    const report = await runCriticalIamSchemaGuard({ query } as never);
    expect(query).toHaveBeenCalledWith(CRITICAL_IAM_SCHEMA_GUARD_SQL);
    expect(report.checks.find((check) => check.schemaObject === 'iam.groups')?.ok).toBe(true);
  });

  it('combines the expected Goose head with critical IAM schema invariants', async () => {
    const {
      CRITICAL_IAM_SCHEMA_GUARD_FIELDS,
      buildIamDatabaseReadinessSql,
      evaluateIamDatabaseReadiness,
      resolveExpectedGooseMigration,
    } = await import('./schema-guard.js');
    const expectedMigration = resolveExpectedGooseMigration([
      '0001_iam_core.sql',
      '0065_iam_instance_waste_data_sources.sql',
      '0082_iam_waste_postal_code_enrichment_active_job_unique.sql',
    ]);
    const schemaRow = Object.fromEntries(
      CRITICAL_IAM_SCHEMA_GUARD_FIELDS.map((field) => [field, true])
    );

    expect(expectedMigration).toEqual({
      fileName: '0082_iam_waste_postal_code_enrichment_active_job_unique.sql',
      version: 82,
    });
    expect(buildIamDatabaseReadinessSql()).toContain('MAX(version_id)');

    const ready = evaluateIamDatabaseReadiness(
      { ...schemaRow, current_migration_version: '82' },
      expectedMigration
    );
    expect(ready).toMatchObject({
      ok: true,
      migration: {
        appliedVersion: 82,
        expectedMigration: expectedMigration.fileName,
        expectedVersion: 82,
        ok: true,
      },
      schema: { ok: true },
    });

    const drifted = evaluateIamDatabaseReadiness(
      { ...schemaRow, current_migration_version: '81' },
      expectedMigration
    );
    expect(drifted).toMatchObject({
      ok: false,
      migration: {
        appliedVersion: 81,
        expectedVersion: 82,
        ok: false,
        reasonCode: 'migration_drift',
      },
      schema: { ok: true },
    });

    const numericVersion = evaluateIamDatabaseReadiness(
      { ...schemaRow, current_migration_version: 83 },
      expectedMigration
    );
    expect(numericVersion.migration).toMatchObject({ appliedVersion: 83, ok: true });

    const missingVersion = evaluateIamDatabaseReadiness(schemaRow, expectedMigration);
    expect(missingVersion.migration).toMatchObject({
      appliedVersion: null,
      ok: false,
      reasonCode: 'migration_drift',
    });
  });

  it('rejects missing, malformed, and duplicate Goose migration versions', async () => {
    const { resolveExpectedGooseMigration } = await import('./schema-guard.js');

    expect(() => resolveExpectedGooseMigration(['README.md'])).toThrow('Keine Goose-Migrationen');
    expect(() => resolveExpectedGooseMigration(['latest.sql'])).toThrow(
      'keinen gueltigen numerischen Versionspraefix'
    );
    expect(() => resolveExpectedGooseMigration(['0001_initial.sql', '0001_repeated.sql'])).toThrow(
      'Goose-Migrationsversion 1 ist nicht eindeutig'
    );
  });

  it('runs the combined database readiness query through the query client', async () => {
    const { buildIamDatabaseReadinessSql, runIamDatabaseReadiness } =
      await import('./schema-guard.js');
    const query = vi.fn(async () => ({
      rows: [{ current_migration_version: '2', groups_exists: true }],
    }));

    const report = await runIamDatabaseReadiness({ query } as never, {
      fileName: '0002_latest.sql',
      version: 2,
    });

    expect(query).toHaveBeenCalledWith(buildIamDatabaseReadinessSql());
    expect(report.migration).toMatchObject({ appliedVersion: 2, ok: true });
    expect(report.schema.checks.find((check) => check.schemaObject === 'iam.groups')?.ok).toBe(
      true
    );
  });

  it('uses the established migration directory variable before the SVA fallback', async () => {
    const { resolveIamMigrationsDirectory } = await import('./schema-guard.js');

    expect(
      resolveIamMigrationsDirectory({
        MIGRATIONS_DIR: '/runtime/migrations',
        SVA_MIGRATIONS_DIR: '/legacy/migrations',
      })
    ).toBe('/runtime/migrations');
    expect(resolveIamMigrationsDirectory({ SVA_MIGRATIONS_DIR: '/legacy/migrations' })).toBe(
      '/legacy/migrations'
    );
    expect(resolveIamMigrationsDirectory({})).toBe('packages/data/migrations');
  });

  it('reads and caches the expected migration head per resolved directory', async () => {
    const { resolveExpectedGooseMigrationFromDirectory } = await import('./schema-guard.js');
    const migrationsDirectory = mkdtempSync(resolve(tmpdir(), 'sva-schema-guard-migrations-'));

    try {
      writeFileSync(resolve(migrationsDirectory, '0001_initial.sql'), '-- migration', 'utf8');
      writeFileSync(resolve(migrationsDirectory, '0002_latest.sql'), '-- migration', 'utf8');

      expect(resolveExpectedGooseMigrationFromDirectory(migrationsDirectory)).toEqual({
        fileName: '0002_latest.sql',
        version: 2,
      });

      writeFileSync(
        resolve(migrationsDirectory, '0003_added_after_read.sql'),
        '-- migration',
        'utf8'
      );
      expect(resolveExpectedGooseMigrationFromDirectory(migrationsDirectory)).toEqual({
        fileName: '0002_latest.sql',
        version: 2,
      });
    } finally {
      rmSync(migrationsDirectory, { force: true, recursive: true });
    }
  });
});
