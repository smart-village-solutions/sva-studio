import { beforeEach, describe, expect, it, vi } from 'vitest';

const dnsLookupMock = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  lookup: dnsLookupMock,
}));

import { SvaMainserverError } from './errors';
import { normalizeSvaMainserverUpstreamUrl } from './upstream-url-validation';

describe('normalizeSvaMainserverUpstreamUrl', () => {
  beforeEach(() => {
    dnsLookupMock.mockReset();
    dnsLookupMock.mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
  });

  it('normalizes valid public https urls', async () => {
    await expect(
      normalizeSvaMainserverUpstreamUrl(' https://mainserver.example.invalid/graphql ', 'graphql_base_url', 500)
    ).resolves.toBe('https://mainserver.example.invalid/graphql');
  });

  it('rejects blank and malformed urls', async () => {
    await expect(normalizeSvaMainserverUpstreamUrl('   ', 'graphql_base_url', 500)).rejects.toBeInstanceOf(
      SvaMainserverError
    );
    await expect(
      normalizeSvaMainserverUpstreamUrl('not-a-url', 'graphql_base_url', 500)
    ).rejects.toMatchObject({ code: 'invalid_config', statusCode: 500 });
  });

  it('rejects urls with credentials, fragments and non-https protocols', async () => {
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://user:pass@example.invalid/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config', statusCode: 400 });
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://example.invalid/graphql#secret', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config', statusCode: 400 });
    await expect(
      normalizeSvaMainserverUpstreamUrl('http://example.invalid/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config', statusCode: 400 });
  });

  it('rejects localhost, .local and private ip targets', async () => {
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://localhost/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://internal.local/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://192.168.1.20/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://300.1.2.3/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });
  });

  it('rejects local and private ipv6 targets including bracketed hosts', async () => {
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://[::1]/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://[fc00::1]/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://[fe80::1]/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });
  });

  it('rejects private and malformed ipv4-mapped ipv6 targets but allows public ones', async () => {
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://[::ffff:127.0.0.1]/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://[::ffff:7f00:1:2]/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://[::ffff:0808:0808]/graphql', 'graphql_base_url', 400)
    ).resolves.toBe('https://[::ffff:808:808]/graphql');
  });

  it('rejects hosts that resolve to private addresses, empty lookups or dns failures', async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://public.example.invalid/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });

    dnsLookupMock.mockResolvedValueOnce([]);
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://empty.example.invalid/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });

    dnsLookupMock.mockRejectedValueOnce(new Error('dns failed'));
    await expect(
      normalizeSvaMainserverUpstreamUrl('https://dns.example.invalid/graphql', 'graphql_base_url', 400)
    ).rejects.toMatchObject({ code: 'invalid_config' });
  });
});
