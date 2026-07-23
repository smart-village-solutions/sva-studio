import { describe, expect, it } from 'vitest';

import { buildBackupVerificationEnv, buildS3HeadObjectArgs } from './verify-promote-backup.ts';

describe('verify promote backup', () => {
  it('uses an explicit S3 head-object request for the exact backup object', () => {
    expect(buildS3HeadObjectArgs('https://fileserver.smart-village.app', 'studio-db-backup-staging', 'staging/example.dump')).toEqual([
      '--endpoint-url',
      'https://fileserver.smart-village.app',
      's3api',
      'head-object',
      '--bucket',
      'studio-db-backup-staging',
      '--key',
      'staging/example.dump',
      '--no-cli-pager',
      '--output',
      'json',
    ]);
  });

  it('maps the S3 secrets to the AWS CLI variables without ambient credential fallback', () => {
    const env = buildBackupVerificationEnv({ S3_ACCESS_KEY_ID: 'access', S3_SECRET_ACCESS_KEY: 'secret' });

    expect(env).toMatchObject({
      AWS_ACCESS_KEY_ID: 'access',
      AWS_DEFAULT_REGION: 'us-east-1',
      AWS_EC2_METADATA_DISABLED: 'true',
      AWS_SECRET_ACCESS_KEY: 'secret',
    });
  });
});
