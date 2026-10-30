/** Connection-time SSRF validation for the two public HTTPS consumers. */
import type { LookupFunction } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ lookup: vi.fn(), fetch: vi.fn(), connect: undefined as unknown }));
vi.mock('node:dns/promises', () => ({ lookup: state.lookup }));
vi.mock('undici', () => ({
  fetch: state.fetch,
  Agent: class {
    constructor(options: { connect: unknown }) { state.connect = options.connect; }
  },
}));

import { fetchPublicHttps } from './public-https-fetch.server.js';

const resolveConnection = async (all = false) => {
  const { lookup } = state.connect as { lookup: LookupFunction };
  return new Promise<{ address: unknown; family?: number }>((resolve, reject) => {
    lookup('cdn.example', { all }, (error, address, family) => {
      if (error) reject(error);
      else resolve({ address, family });
    });
  });
};

describe('fetchPublicHttps', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    state.fetch.mockReset();
    state.fetch.mockImplementation((url: URL, init: RequestInit) => fetch(url, init));
    state.lookup.mockReset();
    state.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
  });

  it.each([
    'http://example.org', 'https://user:pass@example.org', 'https://localhost',
    'https://127.0.0.1', 'https://0.0.0.0', 'https://100.64.0.1',
    'https://169.254.169.254', 'https://192.168.1.1', 'https://224.0.0.1',
    'https://[::1]', 'https://[::]', 'https://[fc00::1]', 'https://[fe80::1]',
    'https://[::ffff:127.0.0.1]', 'https://[fec0::1]', 'https://198.18.0.1',
    'https://[64:ff9b:1::a00:1]', 'https://[2001:2::1]', 'https://[3fff::1]',
  ])('rejects unsafe literal destination %s before fetch', async (url) => {
    await expect(fetchPublicHttps(url)).rejects.toThrow('public_https_target_rejected');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('checks DNS at connection time and passes only those addresses to the socket', async () => {
    await fetchPublicHttps('https://cdn.example/logo.svg', { redirect: 'manual' });
    expect(state.lookup).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({
      redirect: 'manual', dispatcher: expect.anything(),
    }));
    await expect(resolveConnection()).resolves.toEqual({ address: '93.184.216.34', family: 4 });
    state.lookup.mockResolvedValue([{ address: '10.0.0.42', family: 4 }]);
    await expect(resolveConnection()).rejects.toThrow('public_https_target_rejected');
  });

  it.each([
    [],
    [{ address: '93.184.216.34', family: 4 }, { address: '::ffff:7f00:1', family: 6 }],
    [{ address: '100.64.0.1', family: 4 }],
    [{ address: 'fc00::1', family: 6 }],
    [{ address: 'fec0::1', family: 6 }],
    [{ address: '198.18.0.1', family: 4 }],
    [{ address: '2001:2::1', family: 6 }],
    [{ address: '3fff::1', family: 6 }],
    [{ address: '64:ff9b:1::a00:1', family: 6 }],
  ])('rejects empty and non-public DNS answers: %j', async (...entries) => {
    state.lookup.mockResolvedValue(entries);
    await fetchPublicHttps('https://cdn.example');
    await expect(resolveConnection(true)).rejects.toThrow('public_https_target_rejected');
  });

  it('returns all checked addresses when requested by Node and propagates DNS failure', async () => {
    const addresses = [{ address: '93.184.216.34', family: 4 }, { address: '2606:4700:4700::1111', family: 6 }];
    state.lookup.mockResolvedValue(addresses);
    await fetchPublicHttps('https://cdn.example');
    await expect(resolveConnection(true)).resolves.toEqual({ address: addresses });
    state.lookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(resolveConnection()).rejects.toThrow('ENOTFOUND');
  });

  it('blocks the actual Undici connection when DNS changes to a private address', async () => {
    const { Agent, fetch: transportFetch } = await vi.importActual<typeof import('undici')>('undici');
    const agent = new Agent({ connect: state.connect as { lookup: LookupFunction } });
    state.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    try {
      state.fetch.mockImplementationOnce((url: URL, init: Parameters<typeof transportFetch>[1]) =>
        transportFetch(url, { ...init, dispatcher: agent })
      );
      await expect(fetchPublicHttps('https://cdn.example', { signal: AbortSignal.timeout(1000) })).rejects.toMatchObject({
        cause: expect.objectContaining({ message: 'public_https_target_rejected' }),
      });
      expect(state.lookup).toHaveBeenCalled();
      expect(state.fetch).toHaveBeenCalledTimes(1);
    } finally {
      await agent.close();
    }
  });

  it('disallows automatic redirect following', async () => {
    await expect(fetchPublicHttps('https://example.org', { redirect: 'follow' })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    await fetchPublicHttps('https://example.org');
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'error' }));
  });
});
