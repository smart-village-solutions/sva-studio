import { describe, expect, it } from 'vitest';

import { matchesSuccessfulStagingEvidence } from './verify-staging-promote-evidence.ts';

describe('staging parity evidence', () => {
  it('accepts only successful staging evidence for the exact target digest', () => {
    expect(matchesSuccessfulStagingEvidence({ digest: 'sha256:expected', environment: 'staging', mutation: 'completed', postflight: 'passed' }, 'sha256:expected')).toBe(true);
    expect(matchesSuccessfulStagingEvidence({ digest: 'sha256:expected', environment: 'staging', postflight: 'passed' }, 'sha256:expected')).toBe(false);
    expect(matchesSuccessfulStagingEvidence({ digest: 'sha256:other', environment: 'staging', mutation: 'completed', postflight: 'passed' }, 'sha256:expected')).toBe(false);
    expect(matchesSuccessfulStagingEvidence({ digest: 'sha256:expected', environment: 'prod', mutation: 'completed', postflight: 'passed' }, 'sha256:expected')).toBe(false);
    expect(matchesSuccessfulStagingEvidence({ digest: 'sha256:expected', environment: 'staging', mutation: 'completed', postflight: 'failed' }, 'sha256:expected')).toBe(false);
  });
});
