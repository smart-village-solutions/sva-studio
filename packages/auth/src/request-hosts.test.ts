import { describe, expect, it } from 'vitest';

import {
  buildRequestOriginFromHeaders,
  parseForwardedHost,
  parseForwardedProto,
  resolveEffectiveRequestHost,
  resolveEffectiveRequestProtocol,
} from './request-hosts';

describe('request-hosts', () => {
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
    const request = new Request('https://studio.example.org/auth/login', {
      headers: {
        forwarded: 'for=192.0.2.60;by=203.0.113.43',
      },
    });

    expect(resolveEffectiveRequestHost(request)).toBe('studio.example.org');
    expect(resolveEffectiveRequestProtocol(request)).toBe('https');
    expect(buildRequestOriginFromHeaders(request)).toBe('https://studio.example.org');
  });
});
