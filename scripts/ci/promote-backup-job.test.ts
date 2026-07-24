import { describe, expect, it } from 'vitest';

import {
  backupBucketFor,
  backupCommand,
  buildBackupComposeDocument,
  buildBackupEvidence,
  buildBackupObjectKey,
  redactBackupError,
} from './promote-backup-job.ts';

describe('promote backup job', () => {
  it('uses environment-separated backup buckets', () => {
    expect(backupBucketFor('staging')).toBe('studio-db-backup-staging');
    expect(backupBucketFor('prod')).toBe('studio-db-backup-production');
  });

  it('uses a deterministic environment, digest and run-scoped backup object key', () => {
    expect(buildBackupObjectKey({
      attempt: '2',
      deployImageDigest: 'sha256:abc123',
      environment: 'staging',
      runId: '456',
      timestamp: new Date('2026-07-23T08:45:12.345Z'),
    })).toBe('staging/2026-07-23T08-45-12-345Z/abc123/456-2.dump');
  });

  it('redacts backup credentials from propagated errors', () => {
    expect(redactBackupError(
      'Upload to https://fileserver.smart-village.app failed for access-key/secret-key',
      ['access-key', 'secret-key'],
    )).toBe('Upload to https://fileserver.smart-village.app failed for [REDACTED]/[REDACTED]');
  });

  it('writes safe failure evidence with the terminal task and log tail', () => {
    expect(buildBackupEvidence({
      bucket: 'studio-db-backup-staging',
      environment: 'staging',
      error: 'Backup failed',
      logTail: 'backup.step=minio_upload_dump state=failed exit_code=1',
      objectKey: 'staging/example.dump',
      status: 'failed',
      task: { exitCode: 1, state: 'complete', taskId: 'task-1' },
    })).toEqual({
      bucket: 'studio-db-backup-staging',
      environment: 'staging',
      error: 'Backup failed',
      logTail: 'backup.step=minio_upload_dump state=failed exit_code=1',
      objectKey: 'staging/example.dump',
      status: 'failed',
      task: { exitCode: 1, state: 'complete', taskId: 'task-1' },
    });
  });

  it('renders an isolated job with upload, download and archive validation', () => {
    const document = buildBackupComposeDocument({ environment: { POSTGRES_PORT: '5432' }, image: 'example@sha256:test' }, {
      accessKey: 'access', bucket: 'studio-db-backup-staging', endpoint: 'https://fileserver.smart-village.app', internalNetwork: 'studio-staging_default', objectKey: 'staging/example.dump', secretKey: 'secret', sourceStack: 'studio-staging',
    });
    expect(Object.keys(document.services)).toEqual(['backup']);
    expect(document.networks.internal).toEqual({ external: true, name: 'studio-staging_default' });
    expect(document.services.backup.networks).toEqual(['internal']);
    expect(document.services.backup.environment).toMatchObject({ POSTGRES_HOST: 'studio-staging_postgres', S3_BUCKET: 'studio-db-backup-staging' });
    expect(document.services.backup.command).toEqual([backupCommand]);
    expect(document.services.backup.entrypoint).toEqual(['sh', '-ec']);
    expect(backupCommand).toContain('aws --endpoint-url "$S3_ENDPOINT" s3 cp "$dump"');
    expect(backupCommand).toContain('backup.step=%s state=started');
    expect(backupCommand).toContain('backup.step=%s state=failed exit_code=%s');
    expect(backupCommand).toContain('backup_step minio_upload_dump');
    expect(backupCommand).toContain('export PGPASSWORD="$POSTGRES_PASSWORD"');
    expect(backupCommand.indexOf('export PGPASSWORD="$POSTGRES_PASSWORD"')).toBeLessThan(backupCommand.indexOf('pg_dump'));
    expect(backupCommand).toContain('sha256sum -c -');
    expect(backupCommand).toContain('backup_step size_verify');
    expect(backupCommand.indexOf('backup_step size_verify')).toBeLessThan(backupCommand.indexOf('backup_step checksum_verify'));
    expect(backupCommand).toContain('pg_restore --list');
    expect(backupCommand).not.toContain('S3_SECRET_ACCESS_KEY=');
  });
});
