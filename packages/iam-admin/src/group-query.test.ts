import { describe, expect, it, vi } from 'vitest';

import { loadGroupDetail } from './group-query.js';

describe('group-query', () => {
  it('builds the group detail query with a single WHERE clause before GROUP BY', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: '44eb565c-58d6-499b-8fe3-194dcdc1b859',
            instance_id: 'de-studio-sandbox',
            group_key: 'admins',
            display_name: 'Admins',
            description: null,
            group_type: 'role_bundle',
            is_active: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
            member_count: 2,
            role_count: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ role_id: 'role-1' }],
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

    await loadGroupDetail(
      { query },
      {
        instanceId: 'de-studio-sandbox',
        groupId: '44eb565c-58d6-499b-8fe3-194dcdc1b859',
      }
    );

    const detailQuery = String(query.mock.calls[0]?.[0]);
    expect(detailQuery).toContain('WHERE g.instance_id = $1');
    expect(detailQuery).toContain('AND g.id = $2::uuid');
    expect(detailQuery).toContain('GROUP BY g.id');
    expect(detailQuery.indexOf('AND g.id = $2::uuid')).toBeLessThan(detailQuery.indexOf('GROUP BY g.id'));
    expect(detailQuery.match(/\bWHERE\b/g)?.length).toBe(1);

    const membershipsQuery = String(query.mock.calls[2]?.[0]);
    expect(membershipsQuery).toContain('a.display_name_ciphertext');
    expect(membershipsQuery).toContain('a.first_name_ciphertext');
    expect(membershipsQuery).toContain('a.last_name_ciphertext');
    expect(membershipsQuery).toContain('a.email_ciphertext');
    expect(membershipsQuery).not.toContain('COALESCE(a.display_name');
    expect(membershipsQuery).not.toContain('CONCAT_WS(');
  });
});
