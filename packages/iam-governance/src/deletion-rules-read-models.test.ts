import type { IamMyDeletionRulesOverview, IamTenantDeletionRulesOverview } from '@sva/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadMyDeletionRulesOverview,
  loadTenantDeletionRulesOverview,
} from './deletion-rules-read-models.js';

type QueryResult = {
  rowCount: number;
  rows: unknown[];
};

const buildClient = (...results: QueryResult[]) => {
  const query = vi.fn(async () => results.shift() ?? { rowCount: 0, rows: [] });
  return { query };
};

describe('deletion-rules/read-models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports tenant deletion rules overview types', () => {
    const overview: IamTenantDeletionRulesOverview = {
      instanceId: 'de-test',
      deactivateAfterDays: 90,
      pseudonymizeAfterDays: 180,
      deleteAfterDays: 365,
      defaultContentStrategy: 'retain',
      allowContentPreferenceOverride: false,
      canEdit: true,
    };

    expect(overview.defaultContentStrategy).toBe('retain');
  });

  it('falls back to baseline defaults when a tenant has no explicit deletion rules row', async () => {
    const client = buildClient({ rowCount: 0, rows: [] });

    const overview = await loadTenantDeletionRulesOverview(client as never, {
      instanceId: 'de-test',
      canEdit: false,
    });

    expect(overview).toEqual({
      instanceId: 'de-test',
      deactivateAfterDays: 90,
      pseudonymizeAfterDays: 180,
      deleteAfterDays: 365,
      defaultContentStrategy: 'retain',
      allowContentPreferenceOverride: false,
      canEdit: false,
    } satisfies IamTenantDeletionRulesOverview);
  });

  it('maps account preference rows into self-service deletion rules view models', async () => {
    const client = buildClient({
      rowCount: 1,
      rows: [
        {
          account_id: '11111111-1111-1111-1111-111111111111',
          last_login_at: '2026-04-01T10:00:00.000Z',
          deletion_lifecycle_state: 'deactivated',
          deactivate_after_days: 90,
          pseudonymize_after_days: 180,
          delete_after_days: 365,
          default_content_strategy: 'retain',
          allow_content_preference_override: true,
          override_content_strategy: 'with_owner_lifecycle',
        },
      ],
    });

    const result = await loadMyDeletionRulesOverview(client as never, {
      instanceId: 'de-test',
      accountId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result).toEqual({
      instanceId: 'de-test',
      lastLoginAt: '2026-04-01T10:00:00.000Z',
      lifecycleState: 'deactivated',
      rules: {
        instanceId: 'de-test',
        deactivateAfterDays: 90,
        pseudonymizeAfterDays: 180,
        deleteAfterDays: 365,
        defaultContentStrategy: 'retain',
        allowContentPreferenceOverride: true,
        canEdit: false,
      },
      contentPreference: {
        isOverridden: true,
        effectiveStrategy: 'with_owner_lifecycle',
        overrideStrategy: 'with_owner_lifecycle',
      },
    } satisfies IamMyDeletionRulesOverview);
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0]?.[0]).toContain('MAX(log.created_at)::text AS last_login_at');
    expect(client.query.mock.calls[0]?.[0]).toContain("log.event_type = 'login'");
  });

  it('suppresses account overrides when the tenant disables them', async () => {
    const client = buildClient({
      rowCount: 1,
      rows: [
        {
          account_id: '11111111-1111-1111-1111-111111111111',
          last_login_at: '2026-04-01T10:00:00.000Z',
          deletion_lifecycle_state: 'active',
          deactivate_after_days: 90,
          pseudonymize_after_days: 180,
          delete_after_days: 365,
          default_content_strategy: 'retain',
          allow_content_preference_override: false,
          override_content_strategy: 'with_owner_lifecycle',
        },
      ],
    });

    const result = await loadMyDeletionRulesOverview(client as never, {
      instanceId: 'de-test',
      accountId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result.rules.allowContentPreferenceOverride).toBe(false);
    expect(result.contentPreference).toEqual({
      isOverridden: false,
      effectiveStrategy: 'retain',
      overrideStrategy: undefined,
    });
  });
});
