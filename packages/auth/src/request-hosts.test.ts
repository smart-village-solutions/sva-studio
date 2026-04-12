import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildRequestOriginFromHeaders,
  parseForwardedAuthority,
  parseForwardedHost,
  parseForwardedProto,
  resolveEffectiveRequestAuthority,
  resolveEffectiveRequestHost,
  resolveEffectiveRequestProtocol,
} from './request-hosts';

describe('request-hosts', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.SVA_PUBLIC_BASE_URL;
    delete process.env.SVA_TRUST_FORWARDED_HEADERS;
  });

  it('accepts explicit host and proto pairs from RFC Forwarded headers', () => {
    expect(parseForwardedHost('for=192.0.2.60;proto=https;host=bb-guben.studio.example.org')).toBe(
      'bb-guben.studio.example.org',
    );
    expect(parseForwardedProto('for=192.0.2.60;proto=https;host=bb-guben.studio.example.org')).toBe('https');
  });

  it('accepts quoted RFC Forwarded host pairs and rejects unsupported proto values', () => {
    expect(parseForwardedHost('for=192.0.2.60;host="BB-GUBEN.studio.example.org"')).toBe(
      'bb-guben.studio.example.org',
    );
    expect(parseForwardedProto('for=192.0.2.60;proto=javascript')).toBeNull();
  });

  it('accepts quoted RFC Forwarded proto pairs', () => {
    expect(parseForwardedProto('for=192.0.2.60;proto="HTTPS";host=bb-guben.studio.example.org')).toBe(
      'https',
    );
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
    expect(resolveEffectiveRequestAuthority(request)).toBe('bb-guben.studio.example.org');
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

  it('uses Forwarded host/proto pairs when dedicated x-forwarded headers are absent', () => {
    process.env.SVA_TRUST_FORWARDED_HEADERS = 'true';
    const request = new Request('http://internal:3000/auth/login', {
      headers: {
        forwarded: 'for=192.0.2.60;proto=https;host=bb-guben.studio.example.org',
      },
    });

    expect(resolveEffectiveRequestHost(request)).toBe('bb-guben.studio.example.org');
    expect(resolveEffectiveRequestAuthority(request)).toBe('bb-guben.studio.example.org');
    expect(resolveEffectiveRequestProtocol(request)).toBe('https');
    expect(buildRequestOriginFromHeaders(request)).toBe('https://bb-guben.studio.example.org');
  });

  it('falls back to the host header when forwarded headers are absent but trust is enabled', () => {
    process.env.SVA_TRUST_FORWARDED_HEADERS = '1';
    const request = new Request('http://internal:3000/auth/login', {
      headers: {
        host: 'bb-guben.studio.example.org',
      },
    });

    expect(resolveEffectiveRequestHost(request)).toBe('bb-guben.studio.example.org');
    expect(resolveEffectiveRequestAuthority(request)).toBe('bb-guben.studio.example.org');
    expect(resolveEffectiveRequestProtocol(request)).toBe('http');
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

  it('trusts forwarded headers by default in production mode', () => {
    process.env.NODE_ENV = 'production';
    const request = new Request('http://internal:3000/auth/login', {
      headers: {
        'x-forwarded-host': 'bb-guben.studio.example.org',
        'x-forwarded-proto': 'https',
      },
    });

    expect(resolveEffectiveRequestHost(request)).toBe('bb-guben.studio.example.org');
    expect(resolveEffectiveRequestProtocol(request)).toBe('https');
  });

  it('falls back to request.url when the forwarded trust flag is invalid in non-production', () => {
    process.env.SVA_TRUST_FORWARDED_HEADERS = 'maybe';
    const request = new Request('https://studio.example.org/auth/login', {
      headers: {
        'x-forwarded-host': 'bb-guben.studio.example.org',
      },
    });

    expect(resolveEffectiveRequestHost(request)).toBe('studio.example.org');
  });

  it('accepts disabled forwarded trust via numeric zero', () => {
    process.env.SVA_TRUST_FORWARDED_HEADERS = '0';
    const request = new Request('https://studio.example.org/auth/login', {
      headers: {
        'x-forwarded-host': 'bb-guben.studio.example.org',
        'x-forwarded-proto': 'https',
      },
    });

    expect(resolveEffectiveRequestHost(request)).toBe('studio.example.org');
    expect(resolveEffectiveRequestProtocol(request)).toBe('https');
  });

  it('preserves the local dev port in the request origin', () => {
    process.env.SVA_TRUST_FORWARDED_HEADERS = 'false';
    process.env.SVA_PUBLIC_BASE_URL = 'http://studio.localhost:3000';
    const request = new Request('http://de-musterhausen.studio.localhost/auth/login', {
      headers: {
        host: 'de-musterhausen.studio.localhost',
      },
    });

    expect(resolveEffectiveRequestHost(request)).toBe('de-musterhausen.studio.localhost');
    expect(resolveEffectiveRequestAuthority(request)).toBe('de-musterhausen.studio.localhost');
    expect(buildRequestOriginFromHeaders(request)).toBe('http://de-musterhausen.studio.localhost:3000');
  });

  it('preserves a forwarded dev port in the request origin', () => {
    process.env.SVA_TRUST_FORWARDED_HEADERS = 'true';
    const request = new Request('http://internal:3000/auth/login', {
      headers: {
        'x-forwarded-host': 'de-musterhausen.studio.localhost:3000',
        'x-forwarded-proto': 'http',
      },
    });

    expect(parseForwardedAuthority('for=192.0.2.60;proto=http;host="de-musterhausen.studio.localhost:3000"')).toBe(
      'de-musterhausen.studio.localhost:3000',
    );
    expect(resolveEffectiveRequestHost(request)).toBe('de-musterhausen.studio.localhost');
    expect(resolveEffectiveRequestAuthority(request)).toBe('de-musterhausen.studio.localhost:3000');
    expect(buildRequestOriginFromHeaders(request)).toBe('http://de-musterhausen.studio.localhost:3000');
  });
});
