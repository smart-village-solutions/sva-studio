import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { resolveInstanceId } from './instance-id-resolution';

const createPoolMock = (queryImpl: (text: string, values?: readonly unknown[]) => Promise<unknown>) => {
  const query = vi.fn(queryImpl);
  const release = vi.fn();
  const connect = vi.fn(async () => ({
    query,
    release,
  }));
  const pool = { connect } as unknown as Pool;

  return { pool, query, release, connect };
};

describe('resolveInstanceId', () => {
  it('returns UUID candidates unchanged without database lookup', async () => {
    const connect = vi.fn();
    const result = await resolveInstanceId({
      resolvePool: () => ({ connect } as unknown as Pool),
      candidate: '11111111-1111-1111-8111-111111111111',
    });

    expect(result).toEqual({
      ok: true,
      instanceId: '11111111-1111-1111-8111-111111111111',
      fromInstanceKey: false,
      created: false,
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it('resolves an existing instance_key to UUID', async () => {
    const mock = createPoolMock(async () => ({
      rowCount: 1,
      rows: [{ id: '22222222-2222-2222-8222-222222222222' }],
    }));

    const result = await resolveInstanceId({
      resolvePool: () => mock.pool,
      candidate: 'dev-local-1',
    });

    expect(result).toEqual({
      ok: true,
      instanceId: '22222222-2222-2222-8222-222222222222',
      fromInstanceKey: true,
      created: false,
    });
    expect(mock.query).toHaveBeenCalledTimes(1);
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it('creates a new instance for missing instance_key when creation is enabled', async () => {
    const mock = createPoolMock(async (text) => {
      if (text.includes('SELECT id')) {
        return { rowCount: 0, rows: [] };
      }
      return {
        rowCount: 1,
        rows: [{ id: '33333333-3333-3333-8333-333333333333' }],
      };
    });

    const result = await resolveInstanceId({
      resolvePool: () => mock.pool,
      candidate: 'dev-local-1',
      createIfMissingFromKey: true,
      displayNameForCreate: 'Lokale Instanz',
    });

    expect(result).toEqual({
      ok: true,
      instanceId: '33333333-3333-3333-8333-333333333333',
      fromInstanceKey: true,
      created: true,
    });
    expect(mock.query).toHaveBeenCalledTimes(2);
    expect(String(mock.query.mock.calls[1]?.[0])).toContain('INSERT INTO iam.instances');
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it('returns invalid_instance for unknown instance_key when creation is disabled', async () => {
    const mock = createPoolMock(async () => ({ rowCount: 0, rows: [] }));

    const result = await resolveInstanceId({
      resolvePool: () => mock.pool,
      candidate: 'dev-local-1',
      createIfMissingFromKey: false,
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_instance' });
    expect(mock.query).toHaveBeenCalledTimes(1);
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it('returns database_unavailable when no pool is configured', async () => {
    const result = await resolveInstanceId({
      resolvePool: () => null,
      candidate: 'dev-local-1',
    });

    expect(result).toEqual({ ok: false, reason: 'database_unavailable' });
  });

  it('maps query errors to database_unavailable and still releases the client', async () => {
    const mock = createPoolMock(async () => {
      throw new Error('query failed');
    });

    const result = await resolveInstanceId({
      resolvePool: () => mock.pool,
      candidate: 'dev-local-1',
    });

    expect(result).toEqual({ ok: false, reason: 'database_unavailable' });
    expect(mock.release).toHaveBeenCalledTimes(1);
  });
});
