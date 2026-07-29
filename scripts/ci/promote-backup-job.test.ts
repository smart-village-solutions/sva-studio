import { describe, expect, it } from 'vitest';

import {
  backupBucketFor,
  backupCommand,
  buildBackupComposeDocument,
  buildBackupDiagnosticObjectKey,
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

  it('stores redacted step diagnostics next to the backup object', () => {
    expect(buildBackupDiagnosticObjectKey('staging/example.dump')).toBe('staging/example.dump.diagnostic.ndjson');
  });

  it('redacts backup credentials from propagated errors', () => {
    expect(redactBackupError(
      'Upload to https://fileserver.smart-village.app failed for access-key/secret-key',
      ['access-key', 'secret-key'],
    )).toBe('Upload to https://fileserver.smart-village.app failed for [REDACTED]/[REDACTED]');
  });

  it('redacts bearer tokens in propagated authorization headers', () => {
    expect(redactBackupError('Authorization: Bearer sensitive-token', [])).toBe('Authorization: Bearer [REDACTED]');
  });

  it('writes safe failure evidence with the terminal task and log tail', () => {
    expect(buildBackupEvidence({
      bucket: 'studio-db-backup-staging',
      diagnosticObjectKey: 'staging/example.dump.diagnostic.ndjson',
      environment: 'staging',
      error: 'Backup failed',
      logTail: 'backup.step=minio_upload_dump state=failed exit_code=1',
      objectKey: 'staging/example.dump',
      status: 'failed',
      task: { exitCode: 1, state: 'complete', taskId: 'task-1' },
    })).toEqual({
      bucket: 'studio-db-backup-staging',
      diagnosticObjectKey: 'staging/example.dump.diagnostic.ndjson',
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
    expect(document.services.backup.environment).toMatchObject({ AWS_REQUEST_CHECKSUM_CALCULATION: 'when_required', POSTGRES_HOST: 'studio-staging_postgres', S3_BUCKET: 'studio-db-backup-staging' });
    expect(document.services.backup.entrypoint).toEqual(['sh', '-ec']);
    expect(document.services.backup.command).toEqual([backupCommand.replaceAll('$', () => '$$')]);
    expect(document.services.backup.command[0]).toContain('$$(mktemp -d)');
    expect(document.services.backup.command[0]).toContain('$${4:-null}');
    expect(document.services.backup.command[0]).not.toMatch(/(?<!\$)\$(?!\$)/u);
    expect(backupCommand).toContain('aws --endpoint-url "$S3_ENDPOINT" s3 cp "$dump"');
    expect(backupCommand).toContain('backup.step=%s state=started');
    expect(backupCommand).toContain('backup.step=%s state=failed exit_code=%s');
    expect(backupCommand).toContain('require_command() { command -v "$1" >/dev/null 2>&1 || exit "$2"; }');
    expect(backupCommand).toContain('require_aws() { if command -v aws >/dev/null 2>&1; then return 0; fi; if [ -x /usr/bin/aws ]; then exit 86; fi; exit 81; }');
    expect(backupCommand).toContain('require_aws');
    expect(backupCommand).toContain('require_command pg_dump 82');
    expect(backupCommand).toContain('require_command pg_restore 83');
    expect(backupCommand).toContain('require_command sha256sum 84');
    expect(backupCommand).toContain('require_command mktemp 85');
    expect(backupCommand).toContain('require_command wc 87');
    expect(backupCommand).toContain('require_command cut 88');
    expect(backupCommand).toContain('backup-diagnostic.ndjson');
    expect(backupCommand).toContain('backup_event "$step" failed "$status"');
    expect(backupCommand).toContain('failure_code="$2"');
    expect(backupCommand).toContain('exit "$failure_code"');
    expect(backupCommand).toContain('upload_diagnostic || printf "backup.diagnostic_upload state=failed');
    expect(backupCommand).toContain('backup_step dump_bytes 90');
    expect(backupCommand).toContain('backup_step pg_dump 91 pg_dump');
    expect(backupCommand).toContain('backup_step dump_nonempty 92 test -s "$dump"');
    expect(backupCommand).toContain('backup_step checksum_create 93');
    expect(backupCommand).toContain('backup_step minio_upload_dump 94');
    expect(backupCommand).toContain('backup_step minio_upload_checksum 95');
    expect(backupCommand).toContain('backup_step minio_download_dump 96');
    expect(backupCommand).toContain('backup_step download_nonempty 97');
    expect(backupCommand).toContain('backup_step size_verify 98');
    expect(backupCommand).toContain('backup_step checksum_verify 99');
    expect(backupCommand).toContain('backup_step archive_validate 100');
    expect(backupCommand).toContain('export PGPASSWORD="$POSTGRES_PASSWORD"');
    expect(backupCommand.indexOf('export PGPASSWORD="$POSTGRES_PASSWORD"')).toBeLessThan(backupCommand.indexOf('backup_step pg_dump 91 pg_dump'));
    expect(backupCommand).toContain('sha256sum -c -');
    expect(backupCommand).toContain('backup_step size_verify');
    expect(backupCommand.indexOf('backup_step size_verify')).toBeLessThan(backupCommand.indexOf('backup_step checksum_verify'));
    expect(backupCommand).toContain('pg_restore --list');
    expect(backupCommand).not.toContain('S3_SECRET_ACCESS_KEY=');
  });
});
