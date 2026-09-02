import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  backupAgentAcceptanceTimeoutMs,
  buildBackupAgentEvidence,
  buildBackupAgentRequest,
} from './submit-backup-agent-request.ts';

describe('backup agent request submission', () => {
  it('creates a short-lived environment-bound request', () => {
    expect(
      buildBackupAgentRequest({
        environment: 'prod',
        deployImageDigest: `sha256:${'b'.repeat(64)}`,
        now: new Date('2026-07-30T10:00:00.000Z'),
        requestId: 'gha-12345678-1',
      })
    ).toEqual({
      action: 'backup-and-verify',
      deployImageDigest: `sha256:${'b'.repeat(64)}`,
      environment: 'prod',
      expiresAt: '2026-07-30T10:10:00.000Z',
      requestId: 'gha-12345678-1',
      version: 2,
    });
  });

  it('allows a bounded minute for authenticated request acceptance', () => {
    expect(backupAgentAcceptanceTimeoutMs).toBe(60_000);
  });

  it('validates SSF backup evidence only below the dedicated object prefix', () => {
    const request = buildBackupAgentRequest({
      environment: 'staging',
      deployImageDigest: `sha256:${'b'.repeat(64)}`,
      now: new Date('2026-07-30T10:00:00.000Z'),
      requestId: 'gha-12345678-1-ssf',
      database: 'ssf',
    });
    const result = {
      bytes: 42,
      objectKey: `staging/ssf/2026-07-30T10-01-00-000Z/${'b'.repeat(64)}/gha-12345678-1-ssf.dump`,
      sha256: 'c'.repeat(64),
      status: 'succeeded',
    };

    expect(buildBackupAgentEvidence(request, result)).toMatchObject({
      database: 'ssf',
      objectKey: result.objectKey,
    });
    expect(() =>
      buildBackupAgentEvidence(request, {
        ...result,
        objectKey: result.objectKey.replace('/ssf/', '/'),
      })
    ).toThrow('Evidence-Vertrag');
  });

  it.each([
    'person@example.test',
    'https://internal.example.test/jobs/1',
    'first line\nsecond line',
    'secret-key=should-not-leak',
  ])('publishes only allowlisted result fields: %s', (sentinel) => {
    const request = buildBackupAgentRequest({
      environment: 'staging',
      deployImageDigest: `sha256:${'b'.repeat(64)}`,
      now: new Date('2026-07-30T10:00:00.000Z'),
      requestId: 'gha-12345678-1',
    });
    const evidence = buildBackupAgentEvidence(request, {
      bytes: 42,
      completedAt: sentinel,
      database: sentinel,
      deployImageDigest: sentinel,
      environment: sentinel,
      error: sentinel,
      logTail: sentinel,
      logs: sentinel,
      objectKey: `staging/2026-07-30T10-01-00-000Z/${'b'.repeat(64)}/gha-12345678-1.dump`,
      requestId: sentinel,
      sha256: 'c'.repeat(64),
      status: 'succeeded',
      steps: [{ detail: sentinel, status: 'succeeded', step: sentinel }],
      tenantInstanceId: sentinel,
    });

    expect(evidence).toEqual({
      bytes: 42,
      database: 'studio',
      deployImageDigest: request.deployImageDigest,
      environment: 'staging',
      objectKey: `staging/2026-07-30T10-01-00-000Z/${'b'.repeat(64)}/gha-12345678-1.dump`,
      requestId: 'gha-12345678-1',
      sha256: 'c'.repeat(64),
      status: 'succeeded',
      version: 1,
    });
    expect(JSON.stringify(evidence)).not.toContain(sentinel);
  });

  it.each([
    'person@example.test',
    'https://internal.example.test/jobs/1',
    'first line\nsecond line',
    'secret-key=should-not-leak',
  ])('rejects unsafe published object keys: %s', (sentinel) => {
    const request = buildBackupAgentRequest({
      environment: 'prod',
      deployImageDigest: `sha256:${'d'.repeat(64)}`,
      now: new Date('2026-07-30T10:00:00.000Z'),
      requestId: 'gha-12345678-1',
    });
    expect(() =>
      buildBackupAgentEvidence(request, {
        bytes: 42,
        objectKey: sentinel,
        sha256: 'e'.repeat(64),
        status: 'succeeded',
      })
    ).toThrow('Evidence-Vertrag');
  });

  it.each([
    'person@example.test',
    'https://internal.example.test/jobs/1',
    'first line\nsecond line',
  ])('does not echo invalid CLI input to stderr: %s', (sentinel) => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', resolve(import.meta.dirname, 'submit-backup-agent-request.ts'), sentinel],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('PROMOTE_BACKUP_AGENT_FAILED');
    expect(result.stderr).not.toContain(sentinel);
  });
});
