import { describe, expect, it, vi } from 'vitest';
import { createClientCredentialsTokenProvider } from './token-provider.js';

describe('client credentials token provider', () => {
  it('caches valid tokens in memory and refreshes explicitly', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'first', expires_in: 120 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'second', expires_in: 120 }), { status: 200 }));
    const provider = createClientCredentialsTokenProvider(
      { tokenUrl: 'https://id.example/token', clientId: 'mcp', clientSecret: 'secret', tokenTimeoutMs: 1_000 }, fetchImpl, () => 1_000
    );
    expect(await provider.getToken()).toBe('first');
    expect(await provider.getToken()).toBe('first');
    expect(await provider.getToken(true)).toBe('second');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const body = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('client_credentials');
  });

  it('does not expose the client secret on token errors', async () => {
    const provider = createClientCredentialsTokenProvider(
      { tokenUrl: 'https://id.example/token', clientId: 'mcp', clientSecret: 'top-secret', tokenTimeoutMs: 1_000 },
      vi.fn().mockResolvedValue(new Response('denied', { status: 401 }))
    );
    await expect(provider.getToken()).rejects.toThrow('service_token_unavailable:401');
  });
});
