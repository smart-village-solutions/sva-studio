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
    expect(parseForwardedHost(', for=1; host=tenant.example.test')).toBeNull();
    expect(parseForwardedHost(null)).toBeNull();
    expect(parseForwardedAuthority('for=1; host=""')).toBeNull();
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

  it('treats the numeric zero trust flag as disabled as well', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', '0');

    const input = request(
      {
        forwarded: 'for=1; proto=http; host=forwarded.example.test',
      },
      'https://url.example.test:9443/path'
    );

    expect(resolveEffectiveRequestHost(input)).toBe('url.example.test');
    expect(resolveEffectiveRequestAuthority(input)).toBe('url.example.test:9443');
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

  it('falls back through host and url data when trusted forwarded headers are missing or invalid', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', 'true');

    const input = request(
      {
        'x-forwarded-host': '%%%invalid%%%',
        'x-forwarded-proto': 'ws',
        forwarded: 'for=1; proto=ftp; host=',
        host: 'Host.Example.Test:8443',
      },
      'https://url.example.test/path'
    );

    expect(resolveEffectiveRequestHost(input)).toBe('%%%invalid%%%');
    expect(resolveEffectiveRequestAuthority(input)).toBe('host.example.test:8443');
    expect(resolveEffectiveRequestProtocol(input)).toBe('https');
  });

  it('uses host and url fallbacks when trusted forwarded authority data is unavailable', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', 'true');

    const hostFallback = request(
      {
        host: 'host.example.test:8443',
      },
      'https://url.example.test/path'
    );

    expect(resolveEffectiveRequestHost(hostFallback)).toBe('host.example.test');
    expect(resolveEffectiveRequestAuthority(hostFallback)).toBe('host.example.test:8443');

    const urlFallback = request({}, 'https://url.example.test:9443/path');
    expect(resolveEffectiveRequestAuthority(urlFallback)).toBe('url.example.test:9443');
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

  it('keeps local dev origins unchanged when the public base url is missing, invalid or protocol-mismatched', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', '1');

    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', '1');

    expect(
      buildRequestOriginFromHeaders(
        request({
          'x-forwarded-host': 'tenant.example.test',
          'x-forwarded-proto': 'https',
        })
      )
    ).toBe('https://tenant.example.test');

    vi.stubEnv('SVA_PUBLIC_BASE_URL', 'https://example.test');
    expect(
      buildRequestOriginFromHeaders(
        request({
          'x-forwarded-host': 'tenant.example.test',
          'x-forwarded-proto': 'https',
        })
      )
    ).toBe('https://tenant.example.test');

    vi.stubEnv('SVA_PUBLIC_BASE_URL', 'not-a-url');
    expect(
      buildRequestOriginFromHeaders(
        request({
          'x-forwarded-host': 'tenant.example.test',
          'x-forwarded-proto': 'https',
        })
      )
    ).toBe('https://tenant.example.test');

    vi.stubEnv('SVA_PUBLIC_BASE_URL', 'http://example.test:9443');
    expect(
      buildRequestOriginFromHeaders(
        request({
          'x-forwarded-host': 'tenant.example.test',
          'x-forwarded-proto': 'https',
        })
      )
    ).toBe('https://tenant.example.test');
  });

  it('adds the public base port for subdomains that share the configured hostname', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', '1');
    vi.stubEnv('SVA_PUBLIC_BASE_URL', 'https://example.test:9443');

    expect(
      buildRequestOriginFromHeaders(
        request({
          'x-forwarded-host': 'deep.tenant.example.test',
          'x-forwarded-proto': 'https',
        })
      )
    ).toBe('https://deep.tenant.example.test:9443');
  });

  it('uses host authority fallback when forwarded headers are not trusted and the host header disagrees with the url host', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', '0');

    const input = request(
      {
        host: 'other.example.test:9555',
      },
      'https://url.example.test:9443/path'
    );

    expect(resolveEffectiveRequestAuthority(input)).toBe('url.example.test:9443');
    expect(resolveEffectiveRequestProtocol(input)).toBe('https');
  });

  it('uses the matching host header authority when forwarded headers are not trusted', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', 'false');

    const input = request(
      {
        host: 'url.example.test:9555',
      },
      'https://url.example.test:9555/path'
    );

    expect(resolveEffectiveRequestAuthority(input)).toBe('url.example.test:9555');
  });

  it('falls back to the url host and authority when trusted forwarding headers are completely absent', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SVA_TRUST_FORWARDED_HEADERS', 'true');

    const input = request({}, 'https://url.example.test:9443/path');

    expect(resolveEffectiveRequestHost(input)).toBe('url.example.test');
    expect(resolveEffectiveRequestAuthority(input)).toBe('url.example.test:9443');
    expect(buildRequestOriginFromHeaders(input)).toBe('https://url.example.test:9443');
  });
});
