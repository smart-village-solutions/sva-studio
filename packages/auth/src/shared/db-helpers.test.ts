import { describe, expect, it, vi } from 'vitest';

import { withInstanceDb } from './db-helpers.js';

describe('withInstanceDb', () => {
  it('sets the iam runtime role and instance scope before executing work', async () => {
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    const release = vi.fn();
    const client = { query, release };
    const connect = vi.fn(async () => client);
    const resolvePool = () => ({ connect });

    await withInstanceDb(resolvePool as never, 'hb-meinquartier', async () => 'ok');

    expect(connect).toHaveBeenCalledTimes(1);
    expect(query.mock.calls.slice(0, 3)).toEqual([
      ['BEGIN'],
      ['SET LOCAL ROLE iam_app;'],
      ['SELECT set_config($1, $2, true);', ['app.instance_id', 'hb-meinquartier']],
    ]);
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rolls back when work fails after setting role and scope', async () => {
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    const release = vi.fn();
    const client = { query, release };
    const connect = vi.fn(async () => client);
    const resolvePool = () => ({ connect });

    await expect(
      withInstanceDb(resolvePool as never, 'hb-meinquartier', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(query.mock.calls.slice(0, 3)).toEqual([
      ['BEGIN'],
      ['SET LOCAL ROLE iam_app;'],
      ['SELECT set_config($1, $2, true);', ['app.instance_id', 'hb-meinquartier']],
    ]);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
