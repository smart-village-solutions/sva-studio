import { describe, expect, it } from 'vitest';

import { isRetryableTokenExchangeError, isTokenErrorLike } from './error-guards';

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

describe('shared/error-guards isRetryableTokenExchangeError', () => {
  it('returns true only for retryable client-authentication failures', () => {
    expect(isRetryableTokenExchangeError({ error: 'invalid_client' })).toBe(true);
    expect(isRetryableTokenExchangeError({ error: 'unauthorized_client' })).toBe(true);
    expect(isRetryableTokenExchangeError({ status: 401 })).toBe(true);
  });

  it('returns false for non-retryable token exchange failures', () => {
    expect(isRetryableTokenExchangeError({ error: 'invalid_grant' })).toBe(false);
    expect(isRetryableTokenExchangeError({ error: 'interaction_required' })).toBe(false);
    expect(isRetryableTokenExchangeError({ name: 'OAuthError', status: 400 })).toBe(false);
    expect(isRetryableTokenExchangeError(undefined)).toBe(false);
  });
});
