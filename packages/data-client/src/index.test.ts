import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createDataClient, dataClientPackageRoles, dataClientVersion } from './index.js';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('@sva/data-client package scaffold', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    state.logger.debug.mockReset();
    state.logger.error.mockReset();
  });

  it('declares the target package role', () => {
    expect(dataClientVersion).toBe('0.0.1');
    expect(dataClientPackageRoles).toContain('http-client');
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
    expect(state.logger.debug).toHaveBeenCalledWith(
      'cache_hit',
      expect.objectContaining({ operation: 'get', path: '/users/1' })
    );
  });

  it('scopes cached responses by base URL and request headers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tenant: 'a' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tenant: 'b' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tenant: 'c' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const firstClient = createDataClient({ baseUrl: 'https://tenant-a.example.invalid', cacheTtlMs: 10_000 });
    const secondClient = createDataClient({ baseUrl: 'https://tenant-b.example.invalid', cacheTtlMs: 10_000 });
    const schema = z.object({ tenant: z.string() });

    await expect(firstClient.get('/users/me', schema, { headers: { Authorization: 'Bearer token-a' } })).resolves.toEqual({
      tenant: 'a',
    });
    await expect(firstClient.get('/users/me', schema, { headers: { Authorization: 'Bearer token-b' } })).resolves.toEqual({
      tenant: 'b',
    });
    await expect(secondClient.get('/users/me', schema, { headers: { Authorization: 'Bearer token-a' } })).resolves.toEqual({
      tenant: 'c',
    });

    await expect(firstClient.get('/users/me', schema, { headers: { Authorization: 'Bearer token-a' } })).resolves.toEqual({
      tenant: 'a',
    });
    await expect(firstClient.get('/users/me', schema, { headers: { Authorization: 'Bearer token-b' } })).resolves.toEqual({
      tenant: 'b',
    });
    await expect(secondClient.get('/users/me', schema, { headers: { Authorization: 'Bearer token-a' } })).resolves.toEqual({
      tenant: 'c',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
});
