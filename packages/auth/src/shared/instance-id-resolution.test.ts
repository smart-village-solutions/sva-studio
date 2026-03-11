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
  it('resolves an existing string instance id from the database', async () => {
    const mock = createPoolMock(async () => ({
      rowCount: 1,
      rows: [{ id: 'de-musterhausen' }],
    }));
    const result = await resolveInstanceId({
      resolvePool: () => mock.pool,
      candidate: 'de-musterhausen',
    });

    expect(result).toEqual({
      ok: true,
      instanceId: 'de-musterhausen',
      fromInstanceKey: false,
      created: false,
    });
    expect(mock.query).toHaveBeenCalledTimes(1);
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it('returns the persisted instance id for an existing string scope', async () => {
    const mock = createPoolMock(async () => ({
      rowCount: 1,
      rows: [{ id: 'tenant-alpha' }],
    }));

    const result = await resolveInstanceId({
      resolvePool: () => mock.pool,
      candidate: 'tenant-alpha',
    });

    expect(result).toEqual({
      ok: true,
      instanceId: 'tenant-alpha',
      fromInstanceKey: false,
      created: false,
    });
    expect(mock.query).toHaveBeenCalledTimes(1);
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it('creates a new instance for missing string scope when creation is enabled', async () => {
    const mock = createPoolMock(async (text) => {
      if (text.includes('SELECT id')) {
        return { rowCount: 0, rows: [] };
      }
      return {
        rowCount: 1,
        rows: [{ id: 'de-musterhausen' }],
      };
    });

    const result = await resolveInstanceId({
      resolvePool: () => mock.pool,
      candidate: 'de-musterhausen',
      createIfMissingFromKey: true,
      displayNameForCreate: 'Lokale Instanz',
    });

    expect(result).toEqual({
      ok: true,
      instanceId: 'de-musterhausen',
      fromInstanceKey: false,
      created: true,
    });
    expect(mock.query).toHaveBeenCalledTimes(2);
    expect(String(mock.query.mock.calls[1]?.[0])).toContain('INSERT INTO iam.instances');
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it('returns invalid_instance for an unknown string scope when creation is disabled', async () => {
    const mock = createPoolMock(async () => ({ rowCount: 0, rows: [] }));

    const result = await resolveInstanceId({
      resolvePool: () => mock.pool,
      candidate: 'de-musterhausen',
      createIfMissingFromKey: false,
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_instance' });
    expect(mock.query).toHaveBeenCalledTimes(1);
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it('falls back to the raw string instance id when no pool is configured', async () => {
    const result = await resolveInstanceId({
      resolvePool: () => null,
      candidate: 'de-musterhausen',
    });

    expect(result).toEqual({
      ok: true,
      instanceId: 'de-musterhausen',
      fromInstanceKey: false,
      created: false,
    });
  });

  it('maps query errors to database_unavailable and still releases the client', async () => {
    const mock = createPoolMock(async () => {
      throw new Error('query failed');
    });

    const result = await resolveInstanceId({
      resolvePool: () => mock.pool,
      candidate: 'de-musterhausen',
    });

    expect(result).toEqual({ ok: false, reason: 'database_unavailable' });
    expect(mock.release).toHaveBeenCalledTimes(1);
  });
});
