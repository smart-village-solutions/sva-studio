import { beforeEach, describe, expect, it, vi } from 'vitest';

const dnsLookupMock = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  lookup: dnsLookupMock,
}));

import {
  normalizeDatabaseConnectionUrl,
  normalizeOutboundHttpUrl,
  normalizePublicUpstreamUrl,
} from './upstream-url-validation.js';

describe('normalizePublicUpstreamUrl', () => {
  beforeEach(() => {
    dnsLookupMock.mockReset();
    dnsLookupMock.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
  });

  it('normalizes valid public https urls', async () => {
    await expect(normalizePublicUpstreamUrl(' https://mainserver.example.invalid/graphql ')).resolves.toBe(
      'https://mainserver.example.invalid/graphql'
    );
  });

  it('returns null for blank, malformed, credentialed or non-https urls', async () => {
    await expect(normalizePublicUpstreamUrl('   ')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('not-a-url')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('https://user:pass@example.invalid/graphql')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('https://example.invalid/graphql#secret')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('http://example.invalid/graphql')).resolves.toBeNull();
  });

  it('returns null for local, reserved and non-public ipv4 targets', async () => {
    await expect(normalizePublicUpstreamUrl('https://localhost/graphql')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('https://internal.local/graphql')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('https://100.64.0.1/graphql')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('https://198.18.0.1/graphql')).resolves.toBeNull();
  });

  it('returns null for local and non-public ipv6 targets', async () => {
    await expect(normalizePublicUpstreamUrl('https://[::1]/graphql')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('https://[fc00::1]/graphql')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('https://[fe90::1]/graphql')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('https://[fec0::1]/graphql')).resolves.toBeNull();
  });

  it('returns null for malformed or non-public ipv4-mapped ipv6 targets and accepts public ones', async () => {
    await expect(normalizePublicUpstreamUrl('https://[::ffff:127.0.0.1]/graphql')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('https://[::ffff:zzzz:1]/graphql')).resolves.toBeNull();
    await expect(normalizePublicUpstreamUrl('https://[::ffff:5db8:d822]/graphql')).resolves.toBe(
      'https://[::ffff:5db8:d822]/graphql'
    );
  });

  it('returns null for hosts that resolve to local or non-public addresses', async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: 'fec0::1', family: 6 }]);
    await expect(normalizePublicUpstreamUrl('https://public.example.invalid/graphql')).resolves.toBeNull();
  });

  it('returns null for hosts that resolve to no addresses or fail dns lookup', async () => {
    dnsLookupMock.mockResolvedValueOnce([]);
    await expect(normalizePublicUpstreamUrl('https://empty.example.invalid/graphql')).resolves.toBeNull();

    dnsLookupMock.mockRejectedValueOnce(new Error('dns unavailable'));
    await expect(normalizePublicUpstreamUrl('https://failing.example.invalid/graphql')).resolves.toBeNull();
  });
});

describe('normalizeOutboundHttpUrl', () => {
  beforeEach(() => {
    dnsLookupMock.mockReset();
    dnsLookupMock.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
  });

  it('accepts public http and https urls when explicitly enabled', async () => {
    await expect(
      normalizeOutboundHttpUrl('http://public.example.invalid/geocode', { allowHttp: true }),
    ).resolves.toBe('http://public.example.invalid/geocode');
    await expect(normalizeOutboundHttpUrl('https://public.example.invalid/geocode')).resolves.toBe(
      'https://public.example.invalid/geocode',
    );
    await expect(normalizeOutboundHttpUrl('https://[2606:4700:4700::1111]/geocode')).resolves.toBe(
      'https://[2606:4700:4700::1111]/geocode',
    );
  });

  it('rejects private targets by default and allows them with opt-in', async () => {
    await expect(
      normalizeOutboundHttpUrl('https://localhost/geocode', { allowHttp: true }),
    ).resolves.toBeNull();
    await expect(
      normalizeOutboundHttpUrl('https://localhost/geocode', {
        allowHttp: true,
        allowPrivateHosts: true,
      }),
    ).resolves.toBe('https://localhost/geocode');
  });
});

describe('normalizeDatabaseConnectionUrl', () => {
  beforeEach(() => {
    dnsLookupMock.mockReset();
    dnsLookupMock.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
  });

  it('accepts public postgres connection strings with credentials', async () => {
    await expect(
      normalizeDatabaseConnectionUrl('postgres://user:pass@db.example.invalid:5432/app'),
    ).resolves.toBe('postgres://user:pass@db.example.invalid:5432/app');
    await expect(
      normalizeDatabaseConnectionUrl('postgres://user:pass@[2001:4860:4860::8888]:5432/app'),
    ).resolves.toBe('postgres://user:pass@[2001:4860:4860::8888]:5432/app');
  });

  it('rejects private database hosts by default and allows them with opt-in', async () => {
    await expect(normalizeDatabaseConnectionUrl('postgres://user:pass@localhost:5432/app')).resolves.toBeNull();
    await expect(
      normalizeDatabaseConnectionUrl('postgres://user:pass@localhost:5432/app', {
        allowPrivateHosts: true,
      }),
    ).resolves.toBe('postgres://user:pass@localhost:5432/app');
  });
});
