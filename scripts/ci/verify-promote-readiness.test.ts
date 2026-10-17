import { describe, expect, it } from 'vitest';

import { assertStandardProductionReadiness } from './verify-promote-readiness.ts';

describe('pre-mutation production readiness', () => {
  it.each([204, 302, 401, 503])('rejects HTTP %i for standard production', (status) => {
    expect(() =>
      assertStandardProductionReadiness({ environment: 'prod', mode: 'standard', status })
    ).toThrow(/PROMOTE_READINESS_NOT_READY/u);
  });

  it('permits HTTP 200 in standard production and skips the pre-mutation check outside it', () => {
    expect(() =>
      assertStandardProductionReadiness({ environment: 'prod', mode: 'standard', status: 200 })
    ).not.toThrow();
    expect(() =>
      assertStandardProductionReadiness({ environment: 'prod', mode: 'recovery', status: 503 })
    ).not.toThrow();
    expect(() =>
      assertStandardProductionReadiness({ environment: 'staging', mode: 'standard', status: 503 })
    ).not.toThrow();
    expect(() =>
      assertStandardProductionReadiness({ environment: 'dev', mode: 'standard', status: 503 })
    ).not.toThrow();
  });
});
