import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createDataClient } from './index';

describe('createDataClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

    const client = createDataClient({ baseUrl: 'https://data.example.invalid' });

    await expect(client.get('/down')).rejects.toThrow('DataClient GET /down failed with 503');
  });
});
