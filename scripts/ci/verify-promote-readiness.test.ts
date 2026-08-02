import { describe, expect, it } from 'vitest';

import { assertStandardProductionReadiness } from './verify-promote-readiness.ts';

describe('pre-mutation production readiness', () => {
  it('requires HTTP 200 for standard production but permits explicit recovery', () => {
    expect(() => assertStandardProductionReadiness({ environment: 'prod', mode: 'standard', status: 503 })).toThrow(/PROMOTE_READINESS_NOT_READY/u);
    expect(() => assertStandardProductionReadiness({ environment: 'prod', mode: 'standard', status: 200 })).not.toThrow();
    expect(() => assertStandardProductionReadiness({ environment: 'prod', mode: 'recovery', status: 503 })).not.toThrow();
  });
});

