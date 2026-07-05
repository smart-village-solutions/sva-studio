import { IAM_DELETED_CONTENT_AUTHOR_TOKEN } from '@sva/core';
import { describe, expect, it, vi } from 'vitest';

import {
  hardDeleteAccount,
  reconcileOwnedContentForAccountDelete,
} from './user-delete-persistence.js';

describe('reconcileOwnedContentForAccountDelete', () => {
  it('anonymizes retained content and clears account references', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ effective_content_strategy: 'retain' }],
      })
      .mockResolvedValueOnce({
        rowCount: 2,
        rows: [],
      });

    await reconcileOwnedContentForAccountDelete({ query }, {
      instanceId: 'de-musterhausen',
      accountId: '11111111-1111-4111-8111-111111111111',
    });

    expect(String(query.mock.calls[0]?.[0])).toContain('account_deletion_content_preferences');
    expect(query.mock.calls[1]).toEqual([
      expect.stringContaining('UPDATE iam.contents'),
      ['de-musterhausen', '11111111-1111-4111-8111-111111111111', IAM_DELETED_CONTENT_AUTHOR_TOKEN],
    ]);
    expect(String(query.mock.calls[1]?.[0])).toContain('WHEN author_account_id = $2::uuid THEN $3');
    expect(String(query.mock.calls[1]?.[0])).toContain('ELSE author_display_name');
    expect(String(query.mock.calls[1]?.[0])).toContain('author_account_id = CASE');
    expect(String(query.mock.calls[1]?.[0])).toContain('creator_account_id = CASE');
    expect(String(query.mock.calls[1]?.[0])).toContain('updater_account_id = CASE');
    expect(String(query.mock.calls[1]?.[0])).not.toContain("deletion_lifecycle_state = 'deleted'");
  });

  it('reuses the deleted content tombstone path for lifecycle-managed content', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ effective_content_strategy: 'with_owner_lifecycle' }],
      })
      .mockResolvedValueOnce({
        rowCount: 3,
        rows: [],
      });

    await reconcileOwnedContentForAccountDelete({ query }, {
      instanceId: 'de-musterhausen',
      accountId: '22222222-2222-4222-8222-222222222222',
    });

    expect(query.mock.calls[1]).toEqual([
      expect.stringContaining('UPDATE iam.contents'),
      ['de-musterhausen', '22222222-2222-4222-8222-222222222222', IAM_DELETED_CONTENT_AUTHOR_TOKEN],
    ]);
    expect(String(query.mock.calls[1]?.[0])).toContain("deletion_lifecycle_state = 'deleted'");
    expect(String(query.mock.calls[1]?.[0])).toContain('deletion_lifecycle_changed_at = NOW()');
    expect(String(query.mock.calls[1]?.[0])).toContain('WHEN author_account_id = $2::uuid THEN $3');
    expect(String(query.mock.calls[1]?.[0])).not.toContain("deletion_lifecycle_state IS DISTINCT FROM 'deleted'");
    expect(String(query.mock.calls[1]?.[0])).toContain('author_account_id = $2::uuid');
  });
});

describe('hardDeleteAccount', () => {
  it('deletes the scoped account row after content preparation succeeded', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ id: '33333333-3333-4333-8333-333333333333' }],
    });

    await hardDeleteAccount({ query }, {
      instanceId: 'de-musterhausen',
      accountId: '33333333-3333-4333-8333-333333333333',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM iam.accounts'),
      ['33333333-3333-4333-8333-333333333333', 'de-musterhausen']
    );
  });

  it('throws a deterministic error when no scoped account row was deleted', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 0,
      rows: [],
    });

    await expect(
      hardDeleteAccount({ query }, {
        instanceId: 'de-musterhausen',
        accountId: '44444444-4444-4444-8444-444444444444',
      })
    ).rejects.toThrow('account_delete_not_found_or_not_deleted');
  });
});
