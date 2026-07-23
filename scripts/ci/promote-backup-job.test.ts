import { describe, expect, it } from 'vitest';

import { backupBucketFor, backupCommand, buildBackupComposeDocument } from './promote-backup-job.ts';

describe('promote backup job', () => {
  it('uses environment-separated backup buckets', () => {
    expect(backupBucketFor('staging')).toBe('studio-db-backup-staging');
    expect(backupBucketFor('prod')).toBe('studio-db-backup-production');
  });

  it('renders an isolated job with upload, download and archive validation', () => {
    const document = buildBackupComposeDocument({ environment: { POSTGRES_PORT: '5432' }, image: 'example@sha256:test' }, {
      accessKey: 'access', bucket: 'studio-db-backup-staging', endpoint: 'https://fileserver.smart-village.app', internalNetwork: 'studio-staging_default', objectKey: 'staging/example.dump', secretKey: 'secret', sourceStack: 'studio-staging',
    });
    expect(Object.keys(document.services)).toEqual(['backup']);
    expect(document.networks.internal).toEqual({ external: true, name: 'studio-staging_default' });
    expect(document.services.backup.networks).toEqual(['internal']);
    expect(document.services.backup.environment).toMatchObject({ POSTGRES_HOST: 'studio-staging_postgres', S3_BUCKET: 'studio-db-backup-staging' });
    expect(backupCommand).toContain('aws --endpoint-url "$S3_ENDPOINT" s3 cp "$dump"');
    expect(backupCommand).toContain('sha256sum -c -');
    expect(backupCommand).toContain('pg_restore --list');
  });
});
