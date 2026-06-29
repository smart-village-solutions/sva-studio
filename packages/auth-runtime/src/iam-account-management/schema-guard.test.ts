import { describe, expect, it, vi } from 'vitest';

describe('schema guard helpers', () => {
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
    expect(CRITICAL_IAM_SCHEMA_GUARD_SQL).toContain("to_regclass('iam.instance_waste_data_sources')");

    const okRow = Object.fromEntries(CRITICAL_IAM_SCHEMA_GUARD_FIELDS.map((field) => [field, true]));
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
    const { CRITICAL_IAM_SCHEMA_GUARD_SQL, runCriticalIamSchemaGuard } = await import('./schema-guard.js');
    const query = vi.fn(async () => ({
      rows: [{ groups_exists: true }],
    }));

    const report = await runCriticalIamSchemaGuard({ query } as never);
    expect(query).toHaveBeenCalledWith(CRITICAL_IAM_SCHEMA_GUARD_SQL);
    expect(report.checks.find((check) => check.schemaObject === 'iam.groups')?.ok).toBe(true);
  });
});
