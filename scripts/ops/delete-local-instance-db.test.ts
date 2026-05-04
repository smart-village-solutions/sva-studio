import { describe, expect, it } from 'vitest';

import {
  buildDeleteLocalInstanceExecutionSql,
  buildDeleteLocalInstanceSummarySql,
  parseDeleteLocalInstanceArgs,
  resolveUnknownNonCascadeInstanceTables,
  shouldRequireInteractiveConfirmation,
} from './delete-local-instance-db.ts';

describe('parseDeleteLocalInstanceArgs', () => {
  it('parses the required hard-delete options', () => {
    expect(
      parseDeleteLocalInstanceArgs([
        '--target-instance-id=demo',
        '--target-db-container=sva-studio-postgres-hb',
        '--force',
      ]),
    ).toMatchObject({
      dryRun: false,
      force: true,
      targetDbContainer: 'sva-studio-postgres-hb',
      targetDbName: 'sva_studio',
      targetDbUser: 'sva',
      targetInstanceId: 'demo',
      yes: false,
    });
  });

  it('fails when the force flag is missing', () => {
    expect(() =>
      parseDeleteLocalInstanceArgs([
        '--target-instance-id=demo',
        '--target-db-container=sva-studio-postgres-hb',
      ]),
    ).toThrow('--force');
  });

  it('accepts dry-run and yes flags', () => {
    expect(
      parseDeleteLocalInstanceArgs([
        '--target-instance-id=demo',
        '--target-db-container=sva-studio-postgres-hb',
        '--force',
        '--dry-run',
        '--yes',
      ]),
    ).toMatchObject({
      dryRun: true,
      yes: true,
    });
  });
});

describe('shouldRequireInteractiveConfirmation', () => {
  it('requires confirmation in tty mode unless yes is set', () => {
    expect(shouldRequireInteractiveConfirmation({ dryRun: false, isTty: true, yes: false })).toBe(true);
    expect(shouldRequireInteractiveConfirmation({ dryRun: false, isTty: true, yes: true })).toBe(false);
  });

  it('skips confirmation outside tty mode and in dry-run mode', () => {
    expect(shouldRequireInteractiveConfirmation({ dryRun: false, isTty: false, yes: false })).toBe(false);
    expect(shouldRequireInteractiveConfirmation({ dryRun: true, isTty: true, yes: false })).toBe(false);
  });
});

describe('delete-local-instance-db SQL planning', () => {
  it('summarizes the root tables that need explicit cleanup', () => {
    const sql = buildDeleteLocalInstanceSummarySql('demo');

    expect(sql).toContain('FROM iam.contents');
    expect(sql).toContain("WHERE instance_id = 'demo'");
    expect(sql).toContain('FROM iam.content_history');
    expect(sql).toContain('FROM iam.instances');
    expect(sql).toContain("WHERE id = 'demo'");
  });

  it('deletes non-cascade content tables before deleting the instance row', () => {
    const sql = buildDeleteLocalInstanceExecutionSql('demo');

    const retentionModeIndex = sql.indexOf("SET LOCAL iam.retention_mode = 'true';");
    const activityLogsDeleteIndex = sql.indexOf("DELETE FROM iam.activity_logs WHERE instance_id = 'demo';");
    const historyDeleteIndex = sql.indexOf("DELETE FROM iam.content_history WHERE instance_id = 'demo';");
    const contentsDeleteIndex = sql.indexOf("DELETE FROM iam.contents WHERE instance_id = 'demo';");
    const instanceDeleteIndex = sql.indexOf("DELETE FROM iam.instances WHERE id = 'demo';");

    expect(retentionModeIndex).toBeGreaterThanOrEqual(0);
    expect(activityLogsDeleteIndex).toBeGreaterThan(retentionModeIndex);
    expect(historyDeleteIndex).toBeGreaterThanOrEqual(0);
    expect(historyDeleteIndex).toBeGreaterThan(activityLogsDeleteIndex);
    expect(contentsDeleteIndex).toBeGreaterThan(historyDeleteIndex);
    expect(instanceDeleteIndex).toBeGreaterThan(contentsDeleteIndex);
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
  });
});

describe('resolveUnknownNonCascadeInstanceTables', () => {
  it('allows the known indirect-cascade and explicit pre-delete tables', () => {
    expect(
      resolveUnknownNonCascadeInstanceTables([
        'account_groups',
        'account_organizations',
        'account_permissions',
        'account_roles',
        'content_history',
        'contents',
        'group_roles',
        'role_permissions',
      ]),
    ).toEqual([]);
  });

  it('reports unexpected non-cascade instance tables', () => {
    expect(resolveUnknownNonCascadeInstanceTables(['contents', 'unexpected_table'])).toEqual(['unexpected_table']);
  });
});
