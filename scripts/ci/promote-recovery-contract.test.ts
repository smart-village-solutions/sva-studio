import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildRecoveryContract,
  runRecoveryContractFromEnvironment,
} from './promote-recovery-contract.ts';

const previousDigest = `ghcr.io/smart-village-solutions/sva-studio@sha256:${'a'.repeat(64)}`;
const targetDigest = `sha256:${'b'.repeat(64)}`;
const previousConfigRevision = 'c'.repeat(64);

describe('promote recovery contract', () => {
  it('does not invent recovery evidence for standard promotes', () => {
    expect(
      buildRecoveryContract({
        environment: 'prod',
        mode: 'standard',
        recoveryReason: undefined,
        previousImage: previousDigest,
        targetImage: targetDigest,
        previousConfigRevision,
      })
    ).toBeNull();
  });

  it('blocks a standard same-digest legacy seed without a bound live config revision', () => {
    expect(() =>
      buildRecoveryContract({
        environment: 'prod',
        mode: 'standard',
        recoveryReason: undefined,
        previousImage: previousDigest,
        targetImage: `sha256:${'a'.repeat(64)}`,
        previousConfigRevision: '',
      })
    ).toThrow(/PROMOTE_RECOVERY_CONTEXT_INVALID/u);
  });

  it('binds recovery to the previous digest and its versioned config revision', () => {
    expect(
      buildRecoveryContract({
        environment: 'prod',
        mode: 'recovery',
        recoveryReason: 'Readiness nach Router-Warmup wiederherstellen',
        previousImage: previousDigest,
        targetImage: targetDigest,
        previousConfigRevision,
      })
    ).toEqual({
      mode: 'recovery',
      reasonRecorded: true,
      previousDigest: `sha256:${'a'.repeat(64)}`,
      previousConfigRevision,
      sameDigestRetry: null,
    });
  });

  it('allows an explicitly documented same-digest infrastructure cause without inventing a code', () => {
    expect(
      buildRecoveryContract({
        environment: 'prod',
        mode: 'recovery',
        recoveryReason: 'Externer Ingress war während des ersten Versuchs nicht erreichbar',
        previousImage: previousDigest,
        targetImage: `sha256:${'a'.repeat(64)}`,
        previousConfigRevision,
      })
    ).toMatchObject({
      sameDigestRetry: { authorization: 'documented-cause', previousFailureCode: null },
    });
  });

  it.each([
    ['missing previous digest', { previousImage: '' }],
    ['missing previous config revision', { previousConfigRevision: '' }],
    ['blank recovery reason', { recoveryReason: '  ' }],
  ])('fails closed for %s', (_, override) => {
    expect(() =>
      buildRecoveryContract({
        environment: 'prod',
        mode: 'recovery',
        recoveryReason: 'Dokumentierte Ursache',
        previousImage: previousDigest,
        targetImage: `sha256:${'a'.repeat(64)}`,
        previousConfigRevision,
        ...override,
      })
    ).toThrow(/PROMOTE_RECOVERY_CONTEXT_INVALID/u);
  });

  it('never persists the free recovery reason', () => {
    const sentinel = 'person@example.test https://internal.example.test secret=value';
    const contract = buildRecoveryContract({
      environment: 'prod',
      mode: 'recovery',
      recoveryReason: sentinel,
      previousImage: previousDigest,
      targetImage: targetDigest,
      previousConfigRevision,
    });
    expect(JSON.stringify(contract)).not.toContain(sentinel);
  });

  it('records only the canonical error code for an invalid runtime context', () => {
    const directory = mkdtempSync(join(tmpdir(), 'promote-recovery-contract-'));
    const failurePath = join(directory, 'failure.json');
    const outputPath = join(directory, 'output');
    const stderr: string[] = [];
    const sentinel = 'person@example.test https://internal.example.test\nsecret=value';
    try {
      expect(
        runRecoveryContractFromEnvironment(
          'prod',
          {
            PROMOTE_MODE: 'recovery',
            RECOVERY_REASON: sentinel,
            PREVIOUS_LIVE_IMAGE: previousDigest,
            DEPLOY_IMAGE_DIGEST: targetDigest,
            PREVIOUS_CONFIG_REVISION: '',
            PROMOTE_FAILURE_PATH: failurePath,
            GITHUB_OUTPUT: outputPath,
          },
          {
            write: (value) => {
              stderr.push(String(value));
              return true;
            },
          }
        )
      ).toBeNull();
      const surfaces = [readFileSync(failurePath, 'utf8'), stderr.join('')];
      for (const surface of surfaces) {
        expect(surface).toContain('PROMOTE_RECOVERY_CONTEXT_INVALID');
        expect(surface).not.toContain(sentinel);
        expect(surface).not.toContain('person@example.test');
        expect(surface).not.toContain('internal.example.test');
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
