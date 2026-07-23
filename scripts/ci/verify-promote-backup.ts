#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { HeadObjectCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

const rootDir = resolve(import.meta.dirname, '../..');

const required = (value: string | undefined, name: string) => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} darf nicht leer sein.`);
  return trimmed;
};

export const buildMinioS3ClientConfig = (env: NodeJS.ProcessEnv): S3ClientConfig => ({
  endpoint: required(env.S3_ENDPOINT, 'S3_ENDPOINT'),
  region: env.AWS_DEFAULT_REGION?.trim() || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: required(env.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'),
    secretAccessKey: required(env.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY'),
  },
});

const main = async () => {
  const bucket = required(process.env.S3_BUCKET, 'S3_BUCKET');
  const objectKey = required(process.env.S3_OBJECT_KEY, 'S3_OBJECT_KEY');
  const runId = required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const attempt = required(process.env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT');
  const client = new S3Client(buildMinioS3ClientConfig(process.env));
  await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));

  const evidencePath = resolve(process.env.RUNNER_TEMP ?? rootDir, `promote-backup-verification-${runId}-${attempt}.json`);
  writeFileSync(evidencePath, `${JSON.stringify({ bucket, objectKey, status: 'verified' }, null, 2)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
