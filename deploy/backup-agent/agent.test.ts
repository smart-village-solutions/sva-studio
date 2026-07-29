import { describe, expect, it } from 'vitest';

import { canonicalRequest, controlKeysFor, runCommand, safeErrorCode, validateOidcClaims, validRequest, validRequestHost } from './agent.mjs';

const request = {
  version: 1,
  action: 'backup-and-verify',
  requestId: 'gha-12345678',
  environment: 'staging',
  deployImageDigest: `sha256:${'a'.repeat(64)}`,
  expiresAt: '2026-07-30T10:10:00.000Z',
} as const;

describe('backup agent runtime contract', () => {
  it('binds GitHub identity to repository, environment and allowlisted main workflow', () => {
    process.env.BACKUP_AGENT_OIDC_AUDIENCE = 'studio-backup-agent';
    process.env.BACKUP_AGENT_GITHUB_REPOSITORY = 'smart-village-solutions/sva-studio';
    process.env.BACKUP_AGENT_ALLOWED_WORKFLOWS = 'promote.yml,staging-backup-drill.yml';
    const claims = {
      aud: 'studio-backup-agent',
      environment: 'staging',
      exp: 1_800,
      iss: 'https://token.actions.githubusercontent.com',
      nbf: 900,
      repository: 'smart-village-solutions/sva-studio',
      workflow_ref: 'smart-village-solutions/sva-studio/.github/workflows/promote.yml@refs/heads/main',
    };
    expect(() => validateOidcClaims(claims, 'staging', 1_000)).not.toThrow();
    expect(() => validateOidcClaims({ ...claims, environment: 'prod' }, 'staging', 1_000)).toThrow('oidc_environment_invalid');
    expect(() => validateOidcClaims({ ...claims, workflow_ref: 'smart-village-solutions/sva-studio/.github/workflows/untrusted.yml@refs/heads/main' }, 'staging', 1_000)).toThrow('oidc_workflow_invalid');
    expect(() => validateOidcClaims({
      ...claims,
      job_workflow_ref: claims.workflow_ref,
      workflow_ref: 'smart-village-solutions/sva-studio/.github/workflows/build.yml@refs/heads/main',
    }, 'staging', 1_000)).not.toThrow();
  });
  it('accepts only short-lived requests', () => {
    expect(validRequest(request, Date.parse('2026-07-30T10:00:00.000Z'))).toBe(true);
    expect(validRequest({ ...request, expiresAt: '2026-07-30T10:10:00.001Z' }, Date.parse('2026-07-30T10:00:00.000Z'))).toBe(false);
  });

  it('requires production maintenance evidence', () => {
    expect(validRequest({ ...request, environment: 'prod' }, Date.parse('2026-07-30T10:00:00.000Z'))).toBe(false);
    expect(validRequest({ ...request, environment: 'prod', maintenanceWindowReference: 'CAB-42' }, Date.parse('2026-07-30T10:00:00.000Z'))).toBe(true);
  });

  it('canonicalizes requests without accepting target overrides', () => {
    expect(canonicalRequest(request)).not.toContain('bucket');
    expect(canonicalRequest(request)).not.toContain('postgresHost');
    expect(validRequest({ ...request, bucket: 'studio-db-backup-production' }, Date.parse('2026-07-30T10:00:00.000Z'))).toBe(false);
  });

  it('accepts only the dedicated host of the requested environment', () => {
    expect(validRequestHost('staging', 'backup-studio-staging.smart-village.app')).toBe(true);
    expect(validRequestHost('prod', 'backup-studio.smart-village.app')).toBe(true);
    expect(validRequestHost('staging', 'backup-studio.smart-village.app')).toBe(false);
    expect(validRequestHost('prod', 'studio.smart-village.app')).toBe(false);
    expect(validRequestHost('unknown', 'backup-studio-staging.smart-village.app')).toBe(false);
  });

  it('uses persistent MinIO control keys for replay and terminal evidence', () => {
    expect(controlKeysFor('gha-12345678')).toEqual({
      request: 'control/requests/gha-12345678.json',
      result: 'control/results/gha-12345678.json',
    });
  });

  it('never propagates credentials or shell traces into terminal error codes', () => {
    expect(safeErrorCode(new Error('aws_failed_1:https://access:secret@minio/upload shell trace'))).toBe('aws_failed_1');
    expect(safeErrorCode(new Error('password=secret'))).toBe('backup_failed');
  });

  it('terminates an external command after its explicit deadline', async () => {
    await expect(runCommand(
      process.execPath,
      ['-e', 'setTimeout(() => {}, 60_000)'],
      { timeoutMs: 25 },
    )).rejects.toThrow(`${process.execPath}_timeout`);
  });
});
