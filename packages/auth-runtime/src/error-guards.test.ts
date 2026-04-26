import { describe, expect, it } from 'vitest';

import { isRetryableTokenExchangeError, isTokenErrorLike } from './error-guards.js';

describe('auth-runtime error guards', () => {
  it('recognizes token and oauth shaped errors', () => {
    expect(isTokenErrorLike({ name: 'TokenRefreshError' })).toBe(true);
    expect(isTokenErrorLike({ name: 'OAuthError' })).toBe(true);
    expect(isTokenErrorLike({ code: 'token_invalid' })).toBe(true);
    expect(isTokenErrorLike({ error: 'invalid_grant' })).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isTokenErrorLike(undefined)).toBe(false);
    expect(isTokenErrorLike(123)).toBe(false);
    expect(isTokenErrorLike({ name: 'ValidationError', code: 'bad_input' })).toBe(false);
  });

  it('recognizes retryable token exchange failures', () => {
    expect(isRetryableTokenExchangeError({ error: 'invalid_client' })).toBe(true);
    expect(isRetryableTokenExchangeError({ error: 'unauthorized_client' })).toBe(true);
    expect(isRetryableTokenExchangeError({ status: 401 })).toBe(true);
  });

  it('does not retry non-client token exchange failures', () => {
    expect(isRetryableTokenExchangeError({ error: 'invalid_grant' })).toBe(false);
    expect(isRetryableTokenExchangeError({ error: 'interaction_required' })).toBe(false);
    expect(isRetryableTokenExchangeError({ name: 'OAuthError', status: 400 })).toBe(false);
    expect(isRetryableTokenExchangeError(undefined)).toBe(false);
  });
});
