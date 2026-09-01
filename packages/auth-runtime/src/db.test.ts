import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const poolOnMock = vi.hoisted(() => vi.fn());

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: vi.fn(() => state.logger),
}));

vi.mock('pg', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      on: poolOnMock,
    };
  }),
}));

import { createPoolResolver, jsonResponse, withResolvedIamAppDb } from './db.js';

describe('jsonResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks auth runtime JSON responses as private and non-cacheable by default', () => {
    const response = jsonResponse(200, { ok: true });

    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Vary')).toBe('Cookie');
  });

  it('preserves explicit cache directives and appends Cookie to Vary once', () => {
    const response = jsonResponse(200, { ok: true }, {
      'Cache-Control': 'no-store',
      Vary: 'Origin, Cookie',
      'X-Request-Id': 'req-1',
    });

    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Vary')).toBe('Origin, Cookie');
    expect(response.headers.get('X-Request-Id')).toBe('req-1');
  });
});

describe('createPoolResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a pool error handler that logs unexpected idle-client failures', () => {
    const resolvePool = createPoolResolver(() => 'postgres://studio:studio@127.0.0.1:5432/sva_studio');

    resolvePool();

    expect(poolOnMock).toHaveBeenCalledWith('error', expect.any(Function));

    const errorHandler = poolOnMock.mock.calls.find(([eventName]) => eventName === 'error')?.[1];
    const poolError = Object.assign(new Error('terminating connection due to administrator command'), {
      code: '57P01',
    });

    errorHandler?.(poolError);

    expect(state.logger.error).toHaveBeenCalledWith(
      'iam_database_pool_error',
      expect.objectContaining({
        code: '57P01',
        error: 'terminating connection due to administrator command',
        operation: 'iam_database_pool',
      })
    );
  });
});

describe('withResolvedIamAppDb', () => {
  it('runs fleet-wide IAM work in a transaction under the iam_app role', async () => {
    const release = vi.fn();
    const query = vi.fn(async (statement: string) => ({
      rowCount: statement === 'SELECT snapshot' ? 1 : 0,
      rows: statement === 'SELECT snapshot' ? [{ value: 'ready' }] : [],
    }));
    const pool = { connect: vi.fn(async () => ({ query, release })) };

    await expect(
      withResolvedIamAppDb(
        () => pool as never,
        async (client) => (await client.query<{ value: string }>('SELECT snapshot')).rows[0]?.value
      )
    ).resolves.toBe('ready');

    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      'BEGIN',
      'SET LOCAL ROLE iam_app;',
      'SELECT snapshot',
      'COMMIT',
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('rolls back and releases the client when fleet-wide IAM work fails', async () => {
    const release = vi.fn();
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    const pool = { connect: vi.fn(async () => ({ query, release })) };
    const failure = new Error('snapshot failed');

    await expect(
      withResolvedIamAppDb(
        () => pool as never,
        async () => {
          throw failure;
        }
      )
    ).rejects.toBe(failure);

    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      'BEGIN',
      'SET LOCAL ROLE iam_app;',
      'ROLLBACK',
    ]);
    expect(release).toHaveBeenCalledOnce();
  });
});
