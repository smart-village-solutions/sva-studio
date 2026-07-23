#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { commandExists, runCapture } from '../ops/runtime/process.ts';

const rootDir = resolve(import.meta.dirname, '../..');

const required = (value: string | undefined, name: string) => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} darf nicht leer sein.`);
  return trimmed;
};

export const buildS3HeadObjectArgs = (endpoint: string, bucket: string, objectKey: string) => [
  '--endpoint-url',
  endpoint,
  's3api',
  'head-object',
  '--bucket',
  bucket,
  '--key',
  objectKey,
  '--no-cli-pager',
  '--output',
  'json',
] as const;

export const buildBackupVerificationEnv = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => ({
  ...env,
  AWS_ACCESS_KEY_ID: required(env.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'),
  AWS_DEFAULT_REGION: env.AWS_DEFAULT_REGION?.trim() || 'us-east-1',
  AWS_EC2_METADATA_DISABLED: 'true',
  AWS_SECRET_ACCESS_KEY: required(env.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY'),
});

const main = () => {
  const bucket = required(process.env.S3_BUCKET, 'S3_BUCKET');
  const endpoint = required(process.env.S3_ENDPOINT, 'S3_ENDPOINT');
  const objectKey = required(process.env.S3_OBJECT_KEY, 'S3_OBJECT_KEY');
  const runId = required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const attempt = required(process.env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT');
  if (!commandExists(rootDir, 'aws')) throw new Error('AWS CLI ist für die externe Backup-Verifikation nicht verfügbar.');

  runCapture(rootDir, 'aws', buildS3HeadObjectArgs(endpoint, bucket, objectKey), buildBackupVerificationEnv(process.env));

  const evidencePath = resolve(process.env.RUNNER_TEMP ?? rootDir, `promote-backup-verification-${runId}-${attempt}.json`);
  writeFileSync(evidencePath, `${JSON.stringify({ bucket, objectKey, status: 'verified' }, null, 2)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
