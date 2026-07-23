#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const required = (value: string | undefined, name: string) => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} darf nicht leer sein.`);
  return trimmed;
};

const outputPath = resolve(process.env.RUNNER_TEMP ?? process.cwd(), `promote-staging-parity-${required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID')}.json`);
writeFileSync(outputPath, `${JSON.stringify({
  completedAt: new Date().toISOString(),
  digest: required(process.env.DEPLOY_IMAGE_DIGEST, 'DEPLOY_IMAGE_DIGEST'),
  environment: 'staging',
  mutation: required(process.env.STAGING_MUTATION, 'STAGING_MUTATION') === 'true' ? 'completed' : 'not-run',
  postflight: 'passed',
  workflowRunId: required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID'),
}, null, 2)}\n`);
