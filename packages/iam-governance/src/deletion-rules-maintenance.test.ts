import { describe, expect, it, vi } from 'vitest';

import { runDeletionRulesMaintenance } from './deletion-rules-maintenance.js';
import type { QueryClient } from './query-client.js';

type MaintenanceRow = {
  id: string;
  last_login_at: string | null;
  deletion_lifecycle_state: 'active' | 'deactivated' | 'pseudonymized' | 'deleted';
  deactivate_after_days: number | null;
  pseudonymize_after_days: number | null;
  delete_after_days: number | null;
  default_content_strategy: 'retain' | 'on_deactivation' | 'on_pseudonymization' | 'on_deletion' | null;
  override_content_strategy: 'retain' | 'on_deactivation' | 'on_pseudonymization' | 'on_deletion' | null;
};

const buildClient = (rows: readonly MaintenanceRow[], contentUpdates: readonly number[] = []) => {
  const query = vi.fn<QueryClient['query']>(async (sql, params) => {
    if (sql.includes('FROM iam.accounts account')) {
      return {
        rowCount: rows.length,
        rows,
      };
    }

    if (sql.includes('UPDATE iam.contents')) {
      return {
        rowCount: contentUpdates.shift() ?? 0,
        rows: [],
      };
    }

    return {
      rowCount: 1,
      rows: [],
    };
  });

  return { query };
};

describe('deletion-rules/maintenance', () => {
  it('returns dry-run counts without mutations and skips accounts without last_login_at', async () => {
    const client = buildClient([
      {
        id: 'active-due',
        last_login_at: '2025-01-01T00:00:00.000Z',
        deletion_lifecycle_state: 'active',
        deactivate_after_days: 90,
        pseudonymize_after_days: 180,
        delete_after_days: 365,
        default_content_strategy: 'retain',
        override_content_strategy: null,
      },
      {
        id: 'deactivated-due',
        last_login_at: '2025-01-01T00:00:00.000Z',
        deletion_lifecycle_state: 'deactivated',
        deactivate_after_days: 90,
        pseudonymize_after_days: 180,
        delete_after_days: 365,
        default_content_strategy: 'on_pseudonymization',
        override_content_strategy: null,
      },
      {
        id: 'pseudonymized-due',
        last_login_at: '2025-01-01T00:00:00.000Z',
        deletion_lifecycle_state: 'pseudonymized',
        deactivate_after_days: 90,
        pseudonymize_after_days: 180,
        delete_after_days: 365,
        default_content_strategy: 'on_deletion',
        override_content_strategy: null,
      },
      {
        id: 'not-due-yet',
        last_login_at: '2026-05-01T00:00:00.000Z',
        deletion_lifecycle_state: 'active',
        deactivate_after_days: 90,
        pseudonymize_after_days: 180,
        delete_after_days: 365,
        default_content_strategy: 'retain',
        override_content_strategy: null,
      },
      {
        id: 'skip-null-login',
        last_login_at: null,
        deletion_lifecycle_state: 'active',
        deactivate_after_days: 90,
        pseudonymize_after_days: 180,
        delete_after_days: 365,
        default_content_strategy: 'retain',
        override_content_strategy: null,
      },
    ]);

    await expect(
      runDeletionRulesMaintenance(client, {
        instanceId: 'de-test',
        dryRun: true,
        now: new Date('2026-05-20T00:00:00.000Z'),
      })
    ).resolves.toEqual({
      instanceId: 'de-test',
      evaluatedAccounts: 4,
      deactivatedAccounts: 1,
      pseudonymizedAccounts: 1,
      deletedAccounts: 1,
      tombstonedContents: 0,
    });

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0]?.[0]).toContain('MAX(log.created_at)::text AS last_login_at');
    expect(client.query.mock.calls[0]?.[0]).toContain("log.event_type = 'login'");
  });

  it('marks due accounts as deactivated before pseudonymization when multiple thresholds are already exceeded', async () => {
    const client = buildClient(
      [
        {
          id: 'account-1',
          last_login_at: '2025-01-01T00:00:00.000Z',
          deletion_lifecycle_state: 'active',
          deactivate_after_days: 30,
          pseudonymize_after_days: 60,
          delete_after_days: 90,
          default_content_strategy: 'on_deactivation',
          override_content_strategy: null,
        },
      ],
      [2]
    );

    const summary = await runDeletionRulesMaintenance(client, {
      instanceId: 'de-test',
      dryRun: false,
      now: new Date('2026-05-20T00:00:00.000Z'),
    });

    expect(summary).toEqual({
      instanceId: 'de-test',
      evaluatedAccounts: 1,
      deactivatedAccounts: 1,
      pseudonymizedAccounts: 0,
      deletedAccounts: 0,
      tombstonedContents: 2,
    });
    expect(client.query.mock.calls.some(([, params]) => params?.includes('pseudonymized'))).toBe(false);
    expect(client.query.mock.calls.some(([, params]) => params?.includes('deactivated'))).toBe(true);
  });

  it('propagates later lifecycle stages into iam.contents with stable pseudonymized and deleted labels', async () => {
    const client = buildClient(
      [
        {
          id: 'account-2',
          last_login_at: '2025-01-01T00:00:00.000Z',
          deletion_lifecycle_state: 'deactivated',
          deactivate_after_days: 30,
          pseudonymize_after_days: 60,
          delete_after_days: 90,
          default_content_strategy: 'on_pseudonymization',
          override_content_strategy: null,
        },
        {
          id: 'account-3',
          last_login_at: '2025-01-01T00:00:00.000Z',
          deletion_lifecycle_state: 'pseudonymized',
          deactivate_after_days: 30,
          pseudonymize_after_days: 60,
          delete_after_days: 90,
          default_content_strategy: 'retain',
          override_content_strategy: 'on_deletion',
        },
      ],
      [1, 3]
    );

    const summary = await runDeletionRulesMaintenance(client, {
      instanceId: 'de-test',
      dryRun: false,
      now: new Date('2026-05-20T00:00:00.000Z'),
    });

    expect(summary).toEqual({
      instanceId: 'de-test',
      evaluatedAccounts: 2,
      deactivatedAccounts: 0,
      pseudonymizedAccounts: 1,
      deletedAccounts: 1,
      tombstonedContents: 4,
    });

    const contentUpdateCalls = client.query.mock.calls.filter(([sql]) => sql.includes('UPDATE iam.contents'));
    expect(contentUpdateCalls).toHaveLength(2);
    expect(contentUpdateCalls[0]?.[0]).toContain('Pseudonymisiert');
    expect(contentUpdateCalls[0]?.[0]).toContain('Gelöscht');
    expect(contentUpdateCalls.map(([, params]) => params?.[2])).toEqual(['pseudonymized', 'deleted']);
  });
});
