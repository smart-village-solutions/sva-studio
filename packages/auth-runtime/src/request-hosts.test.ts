import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildRequestOriginFromHeaders,
  parseForwardedAuthority,
  parseForwardedHost,
  parseForwardedProto,
  resolveEffectiveRequestAuthority,
  resolveEffectiveRequestHost,
  resolveEffectiveRequestProtocol,
} from './request-hosts.js';

const request = (headers: HeadersInit = {}, url = 'https://url.example.test/path') =>
  new Request(url, { headers });

describe('request host resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses forwarded header pairs defensively', () => {
    expect(parseForwardedHost('for=1; proto=https; host="Tenant.Example.Test:8443"')).toBe('tenant.example.test');
    expect(parseForwardedAuthority('for=1; host=Tenant.Example.Test:8443')).toBe('tenant.example.test:8443');
    expect(parseForwardedProto('for=1; proto=HTTPS')).toBe('https');
    expect(parseForwardedProto('for=1; proto=ftp')).toBeNull();
    expect(parseForwardedHost('for=1; host=')).toBeNull();
    expect(parseForwardedAuthority('bad-authority')).toBeNull();
  });

  it('ignores forwarded headers when trust is disabled', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', 'false');

    const input = request(
      {
        'x-forwarded-host': 'forwarded.example.test',
        'x-forwarded-proto': 'http',
        host: 'host.example.test',
      },
      'https://url.example.test:9443/path'
    );

    expect(resolveEffectiveRequestHost(input)).toBe('url.example.test');
    expect(resolveEffectiveRequestAuthority(input)).toBe('url.example.test:9443');
    expect(resolveEffectiveRequestProtocol(input)).toBe('https');
  });

  it('uses trusted forwarded headers in production mode', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', '');

    const input = request({
      forwarded: 'for=1; proto=https; host=forwarded.example.test',
      host: 'host.example.test',
    });

    expect(resolveEffectiveRequestHost(input)).toBe('forwarded.example.test');
    expect(resolveEffectiveRequestAuthority(input)).toBe('forwarded.example.test');
    expect(resolveEffectiveRequestProtocol(input)).toBe('https');
    expect(buildRequestOriginFromHeaders(input)).toBe('https://forwarded.example.test');
  });

  it('preserves trusted authority ports and applies local public base url fallback', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', '1');
    vi.stubEnv('SVA_PUBLIC_BASE_URL', 'https://example.test:9443');

    expect(
      buildRequestOriginFromHeaders(
        request({
          'x-forwarded-host': 'tenant.example.test',
          'x-forwarded-proto': 'https',
        })
      )
    ).toBe('https://tenant.example.test:9443');

    expect(
      buildRequestOriginFromHeaders(
        request({
          'x-forwarded-host': 'tenant.example.test:7443',
          'x-forwarded-proto': 'https',
        })
      )
    ).toBe('https://tenant.example.test:7443');
  });
});
