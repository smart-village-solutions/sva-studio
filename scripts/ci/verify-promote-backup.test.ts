import { describe, expect, it } from 'vitest';

import { buildMinioS3ClientConfig } from './verify-promote-backup.ts';

describe('verify promote backup', () => {
  it('configures the established MinIO endpoint with path-style addressing', () => {
    expect(buildMinioS3ClientConfig({
      S3_ACCESS_KEY_ID: 'access',
      S3_ENDPOINT: 'https://fileserver.smart-village.app',
      S3_SECRET_ACCESS_KEY: 'secret',
    })).toEqual({
      credentials: {
        accessKeyId: 'access',
        secretAccessKey: 'secret',
      },
      endpoint: 'https://fileserver.smart-village.app',
      forcePathStyle: true,
      region: 'us-east-1',
    });
  });
});
