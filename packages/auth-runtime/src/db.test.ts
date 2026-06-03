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

import { createPoolResolver, jsonResponse } from './db.js';

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
