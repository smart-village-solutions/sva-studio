import { spawnSync } from 'node:child_process';
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

  it.each(['standard', 'recovery'] as const)(
    'fails closed for an invalid environment in %s mode',
    (mode) => {
      expect(() =>
        buildRecoveryContract({
          environment: 'invalid',
          mode,
          recoveryReason: mode === 'recovery' ? 'Dokumentierte Ursache' : undefined,
          previousImage: previousDigest,
          targetImage: targetDigest,
          previousConfigRevision,
        })
      ).toThrow(/PROMOTE_RECOVERY_CONTEXT_INVALID/u);
    }
  );

  it.each([
    ['staging digest change', 'staging', targetDigest],
    ['staging same digest', 'staging', `sha256:${'a'.repeat(64)}`],
    ['production digest change', 'prod', targetDigest],
    ['production same digest', 'prod', `sha256:${'a'.repeat(64)}`],
  ] as const)(
    'blocks a standard %s legacy seed without a bound live config revision',
    (_, environment, targetImage) => {
      expect(() =>
        buildRecoveryContract({
          environment,
          mode: 'standard',
          recoveryReason: undefined,
          previousImage: previousDigest,
          targetImage,
          previousConfigRevision: '',
        })
      ).toThrow(/PROMOTE_RECOVERY_CONTEXT_INVALID/u);
    }
  );

  it('allows disposable Dev standard promotes without a previous config revision', () => {
    expect(
      buildRecoveryContract({
        environment: 'dev',
        mode: 'standard',
        recoveryReason: undefined,
        previousImage: previousDigest,
        targetImage: targetDigest,
        previousConfigRevision: '',
      })
    ).toBeNull();
  });

  it('allows only a separately bound Staging seed authorization without a previous revision', () => {
    expect(
      buildRecoveryContract({
        environment: 'staging',
        mode: 'standard',
        recoveryReason: undefined,
        previousImage: previousDigest,
        targetImage: `sha256:${'a'.repeat(64)}`,
        previousConfigRevision: '',
        targetConfigRevision: previousConfigRevision,
        sourceSha: 'd'.repeat(40),
        seedAuthorization: {
          authorization: 'staging-legacy-config-label-v1',
          evidenceRun: { id: '123456', attempt: 1 },
          sourceSha: 'd'.repeat(40),
          imageDigest: `sha256:${'a'.repeat(64)}`,
          configRevision: previousConfigRevision,
        },
      })
    ).toBeNull();
  });

  it.each([
    ['production', { environment: 'prod' as const }],
    ['recovery', { mode: 'recovery' }],
    ['digest change', { targetImage: targetDigest }],
    ['foreign source', { sourceSha: 'e'.repeat(40) }],
    ['foreign config', { targetConfigRevision: 'e'.repeat(64) }],
  ])('does not let a seed authorization bypass %s', (_, override) => {
    expect(() =>
      buildRecoveryContract({
        environment: 'staging',
        mode: 'standard',
        recoveryReason: undefined,
        previousImage: previousDigest,
        targetImage: `sha256:${'a'.repeat(64)}`,
        previousConfigRevision: '',
        targetConfigRevision: previousConfigRevision,
        sourceSha: 'd'.repeat(40),
        seedAuthorization: {
          authorization: 'staging-legacy-config-label-v1',
          evidenceRun: { id: '123456', attempt: 1 },
          sourceSha: 'd'.repeat(40),
          imageDigest: `sha256:${'a'.repeat(64)}`,
          configRevision: previousConfigRevision,
        },
        ...override,
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
      ).toEqual({ ok: false, contract: null });
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

  it('exits non-zero for a standard contract failure without a failure-record path', () => {
    const script = new URL('./promote-recovery-contract.ts', import.meta.url);
    const result = spawnSync(
      process.execPath,
      ['--no-warnings', '--experimental-strip-types', script.pathname, 'staging'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PROMOTE_MODE: 'standard',
          PREVIOUS_LIVE_IMAGE: previousDigest,
          DEPLOY_IMAGE_DIGEST: targetDigest,
          PREVIOUS_CONFIG_REVISION: '',
          PROMOTE_FAILURE_PATH: '',
        },
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('PROMOTE_RECOVERY_CONTEXT_INVALID\n');
  });
});
