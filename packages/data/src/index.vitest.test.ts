import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createDataClient } from './index';

describe('createDataClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
  });

  it('parses payloads with schema and caches responses', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: 'Max', age: 42 }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createDataClient({
      baseUrl: 'https://data.example.invalid',
      cacheTtlMs: 10_000,
      logger: state.logger,
    });

    const schema = z.object({ name: z.string(), age: z.number() });
    const first = await client.get('/users/1', schema);
    const second = await client.get('/users/1', schema);

    expect(first).toEqual({ name: 'Max', age: 42 });
    expect(second).toEqual({ name: 'Max', age: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://data.example.invalid/users/1', {
      headers: { Accept: 'application/json' },
    });
    expect(state.logger.debug).toHaveBeenCalledWith(
      'cache_hit',
      expect.objectContaining({ operation: 'get', path: '/users/1' })
    );
  });

  it('emits missing-schema warning only once per path', async () => {
    const warningSpy = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createDataClient({ baseUrl: 'https://data.example.invalid', cacheTtlMs: 0 });

    await client.get('/health');
    await client.get('/health');

    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy).toHaveBeenCalledWith(
      'DataClient.get(/health) called without runtime schema validation',
      { code: 'SVA_DATA_RUNTIME_SCHEMA' }
    );
  });

  it('throws on non-ok responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
      }))
    );

    const client = createDataClient({ baseUrl: 'https://data.example.invalid', logger: state.logger });

    await expect(client.get('/down')).rejects.toThrow('DataClient GET /down failed with 503');
    expect(state.logger.error).toHaveBeenCalledWith(
      'request_failed',
      expect.objectContaining({ operation: 'get', path: '/down', status: 503 })
    );
  });

  it('returns cached payload without schema validation on cache hit', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ health: 'ok' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createDataClient({ baseUrl: 'https://data.example.invalid', cacheTtlMs: 10_000 });

    await expect(client.get('/health/raw')).resolves.toEqual({ health: 'ok' });
    await expect(client.get('/health/raw')).resolves.toEqual({ health: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles non-ok responses without injected logger', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
      }))
    );

    const client = createDataClient({ baseUrl: 'https://data.example.invalid' });

    await expect(client.get('/default-logger-failure')).rejects.toThrow(
      'DataClient GET /default-logger-failure failed with 500'
    );
  });

  it('logs schema validation failures for network payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ age: 'not-a-number' }),
      }))
    );

    const client = createDataClient({ baseUrl: 'https://data.example.invalid', logger: state.logger });

    await expect(client.get('/users/invalid', z.object({ age: z.number() }))).rejects.toThrow();
    expect(state.logger.error).toHaveBeenCalledWith(
      'schema_validation_failed',
      expect.objectContaining({ operation: 'get', path: '/users/invalid', source: 'network' })
    );
  });

  it('invalidates cache entries after schema validation failures on cache hits', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ age: 'stale-invalid' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ age: 42 }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const client = createDataClient({
      baseUrl: 'https://data.example.invalid',
      cacheTtlMs: 10_000,
      logger: state.logger,
    });
    const schema = z.object({ age: z.number() });

    await client.get('/users/cache-invalid');
    await expect(client.get('/users/cache-invalid', schema)).rejects.toThrow();

    await expect(client.get('/users/cache-invalid', schema)).resolves.toEqual({ age: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state.logger.error).toHaveBeenCalledWith(
      'schema_validation_failed',
      expect.objectContaining({ operation: 'get', path: '/users/cache-invalid', source: 'cache' })
    );
  });
});
