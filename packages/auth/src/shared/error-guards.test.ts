import { describe, expect, it } from 'vitest';

import { isTokenErrorLike } from './error-guards';

describe('shared/error-guards isTokenErrorLike', () => {
  it('returns true for token and oauth error signatures', () => {
    expect(isTokenErrorLike({ name: 'TokenRefreshError' })).toBe(true);
    expect(isTokenErrorLike({ name: 'OAuthError' })).toBe(true);
    expect(isTokenErrorLike({ code: 'token_invalid' })).toBe(true);
    expect(isTokenErrorLike({ error: 'invalid_grant' })).toBe(true);
  });

  it('returns false for unrelated values', () => {
    expect(isTokenErrorLike(undefined)).toBe(false);
    expect(isTokenErrorLike(123)).toBe(false);
    expect(isTokenErrorLike({ name: 'ValidationError', code: 'bad_input' })).toBe(false);
  });
});
