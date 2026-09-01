import { describe, expect, it } from 'vitest';

import { resolveRequestLocale } from './request-locale.js';

describe('request locale resolution', () => {
  it('does not select a supported language that the client explicitly rejects', () => {
    const request = new Request('https://studio.example.test', {
      headers: { 'Accept-Language': 'en;q=0,de;q=0.5' },
    });

    expect(resolveRequestLocale(request)).toBe('de');
  });

  it('clamps quality weights to the supported range before ordering preferences', () => {
    const request = new Request('https://studio.example.test', {
      headers: { 'Accept-Language': 'en;q=-1,de;q=2' },
    });

    expect(resolveRequestLocale(request)).toBe('de');
  });
});
