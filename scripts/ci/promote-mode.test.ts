import { describe, expect, it } from 'vitest';

import { validatePromoteLiveRevision, validatePromoteMode } from './promote-mode.ts';

describe('promote mode', () => {
  it('defaults to standard and requires a reason for recovery', () => {
    expect(
      validatePromoteMode({ environment: 'prod', mode: undefined, recoveryReason: undefined })
    ).toBe('standard');
    expect(() =>
      validatePromoteMode({ environment: 'prod', mode: 'recovery', recoveryReason: '  ' })
    ).toThrow(/PROMOTE_RECOVERY_REASON_REQUIRED/u);
    expect(
      validatePromoteMode({
        environment: 'prod',
        mode: 'recovery',
        recoveryReason: 'Production ist degradiert',
      })
    ).toBe('recovery');
    expect(() =>
      validatePromoteMode({ environment: 'prod', mode: 'other', recoveryReason: undefined })
    ).toThrow(/PROMOTE_MODE_INVALID/u);
  });

  it.each(['dev', 'staging'] as const)('rejects recovery in %s', (environment) => {
    expect(() =>
      validatePromoteMode({
        environment,
        mode: 'recovery',
        recoveryReason: 'Dokumentierte Ursache',
      })
    ).toThrow(/PROMOTE_MODE_INVALID/u);
  });

  it.each(['standard', 'recovery'] as const)(
    'requires a valid live config revision for protected %s promotes',
    (mode) => {
      expect(() =>
        validatePromoteLiveRevision({
          environment: 'prod',
          mode,
          recoveryReason: mode === 'recovery' ? 'Dokumentierte Ursache' : undefined,
          previousImage: `ghcr.io/example/app@sha256:${'a'.repeat(64)}`,
          previousConfigRevision: '',
        })
      ).toThrow(/PROMOTE_RECOVERY_CONTEXT_INVALID/u);
    }
  );

  it('allows disposable Dev without a previous config revision', () => {
    expect(
      validatePromoteLiveRevision({
        environment: 'dev',
        mode: 'standard',
        recoveryReason: undefined,
        previousImage: `sha256:${'a'.repeat(64)}`,
        previousConfigRevision: '',
      })
    ).toBe('standard');
  });
});
