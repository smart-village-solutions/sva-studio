import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildRequestOriginFromHeaders,
  parseForwardedHost,
  parseForwardedProto,
  resolveEffectiveRequestHost,
  resolveEffectiveRequestProtocol,
} from './request-hosts';

describe('request-hosts', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.SVA_TRUST_FORWARDED_HEADERS;
  });

  it('accepts explicit host and proto pairs from RFC Forwarded headers', () => {
    expect(parseForwardedHost('for=192.0.2.60;proto=https;host=bb-guben.studio.example.org')).toBe(
      'bb-guben.studio.example.org',
    );
    expect(parseForwardedProto('for=192.0.2.60;proto=https;host=bb-guben.studio.example.org')).toBe('https');
  });

  it('ignores Forwarded headers without an explicit host or proto pair', () => {
    expect(parseForwardedHost('for=192.0.2.60;proto=https')).toBeNull();
    expect(parseForwardedProto('for=192.0.2.60;host=bb-guben.studio.example.org')).toBeNull();
  });

  it('prefers dedicated x-forwarded headers and falls back to the request url otherwise', () => {
    process.env.SVA_TRUST_FORWARDED_HEADERS = 'true';
    const request = new Request('http://internal:3000/auth/login', {
      headers: {
        'x-forwarded-host': 'bb-guben.studio.example.org, proxy.internal',
        'x-forwarded-proto': 'https, http',
      },
    });

    expect(resolveEffectiveRequestHost(request)).toBe('bb-guben.studio.example.org');
    expect(resolveEffectiveRequestProtocol(request)).toBe('https');
    expect(buildRequestOriginFromHeaders(request)).toBe('https://bb-guben.studio.example.org');
  });

  it('does not treat raw Forwarded fragments as hosts or protocols', () => {
    process.env.SVA_TRUST_FORWARDED_HEADERS = 'true';
    const request = new Request('https://studio.example.org/auth/login', {
      headers: {
        forwarded: 'for=192.0.2.60;by=203.0.113.43',
      },
    });

    expect(resolveEffectiveRequestHost(request)).toBe('studio.example.org');
    expect(resolveEffectiveRequestProtocol(request)).toBe('https');
    expect(buildRequestOriginFromHeaders(request)).toBe('https://studio.example.org');
  });

  it('ignores forwarded headers completely when trust is disabled', () => {
    process.env.SVA_TRUST_FORWARDED_HEADERS = 'false';
    const request = new Request('https://studio.example.org/auth/login', {
      headers: {
        host: 'spoofed.example.org',
        'x-forwarded-host': 'bb-guben.studio.example.org',
        'x-forwarded-proto': 'https',
      },
    });

    expect(resolveEffectiveRequestHost(request)).toBe('studio.example.org');
    expect(resolveEffectiveRequestProtocol(request)).toBe('https');
  });

  it('falls back to request.url when forwarded proto is invalid', () => {
    process.env.SVA_TRUST_FORWARDED_HEADERS = 'true';
    const request = new Request('https://studio.example.org/auth/login', {
      headers: {
        'x-forwarded-proto': 'javascript',
      },
    });

    expect(resolveEffectiveRequestProtocol(request)).toBe('https');
  });
});
