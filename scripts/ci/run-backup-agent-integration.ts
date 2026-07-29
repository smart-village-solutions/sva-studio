#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const secret = () => randomBytes(24).toString('hex');
const integrationEnv = {
  ...process.env,
  INTEGRATION_DIGEST: 'a'.repeat(64),
  INTEGRATION_PRODUCTION_POSTGRES_PASSWORD: secret(),
  INTEGRATION_S3_ACCESS_KEY: `test-${randomBytes(6).toString('hex')}`,
  INTEGRATION_S3_SECRET_KEY: secret(),
  INTEGRATION_STAGING_POSTGRES_PASSWORD: secret(),
};
const cwd = new URL('../..', import.meta.url);
const composeArgs = ['compose', '-f', 'deploy/backup-agent/compose.integration.yaml'];
const compose = (args: string[], stdio: 'inherit' | 'pipe' = 'inherit') => spawnSync(
  'docker',
  [...composeArgs, ...args],
  { cwd, env: integrationEnv, encoding: 'utf8', stdio },
);

const containerState = (service: string) => {
  const id = compose(['ps', '--all', '--quiet', service], 'pipe').stdout.trim();
  if (!id) return null;
  const inspect = spawnSync('docker', ['inspect', '--format', '{{json .State}}', id], { encoding: 'utf8' });
  return inspect.status === 0 ? JSON.parse(inspect.stdout) as { ExitCode: number; Status: string } : null;
};

const main = async () => {
  const up = compose(['up', '--build', '--detach']);
  let resultStatus = up.status ?? 1;

  if (resultStatus === 0) {
    const deadline = Date.now() + 120_000;
    for (;;) {
      const verify = containerState('verify');
      if (verify?.Status === 'exited') {
        resultStatus = verify.ExitCode;
        break;
      }
      const failed = ['minio-init', 'staging-agent-run', 'production-agent-run']
        .map(containerState)
        .find((state) => state?.Status === 'exited' && state.ExitCode !== 0);
      if (failed) {
        resultStatus = failed.ExitCode;
        compose(['logs', '--no-color']);
        break;
      }
      if (Date.now() >= deadline) {
        resultStatus = 124;
        compose(['logs', '--no-color']);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }

  if (resultStatus !== 0) compose(['logs', '--no-color']);
  const cleanup = compose(['down', '--volumes', '--remove-orphans']);

  if (resultStatus !== 0) process.exitCode = resultStatus;
  else if (cleanup.status !== 0) process.exitCode = cleanup.status ?? 1;
};

void main();
