#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { commandExists, run, runCapture, runCaptureDetailed, wait, withoutDebugEnv } from '../ops/runtime/process.ts';
import { collectQuantumTaskSnapshots, getMigrationJobTerminalState, selectLatestMigrationTask } from '../ops/runtime/migration-job.ts';
import { extractQuantumJsonPayload } from '../ops/runtime/migration-job.ts';
import { inspectRemoteServiceContract } from '../ops/runtime/remote-service-spec.ts';
import { pickInternalNetworkName } from '../ops/runtime/internal-network.ts';

type PromoteEnvironment = 'prod' | 'staging';

const rootDir = resolve(import.meta.dirname, '../..');
const required = (value: string | undefined, name: string) => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} darf nicht leer sein.`);
  return trimmed;
};

const parseEnvironment = (value: string | undefined): PromoteEnvironment => {
  if (value === 'staging' || value === 'prod') return value;
  throw new Error('Der Backup-Job ist nur für staging oder prod zulässig.');
};

export const backupBucketFor = (environment: PromoteEnvironment) =>
  environment === 'staging' ? 'studio-db-backup-staging' : 'studio-db-backup-production';

export const buildBackupObjectKey = ({
  attempt,
  deployImageDigest,
  environment,
  runId,
  timestamp,
}: {
  attempt: string;
  deployImageDigest: string;
  environment: PromoteEnvironment;
  runId: string;
  timestamp: Date;
}) => `${environment}/${timestamp.toISOString().replace(/[:.]/gu, '-')}/${deployImageDigest.replace(/^sha256:/u, '')}/${runId}-${attempt}.dump`;

export const redactBackupError = (value: string, sensitiveValues: readonly string[]) =>
  sensitiveValues
    .filter((sensitiveValue) => sensitiveValue.trim().length > 0)
    .reduce((redacted, sensitiveValue) => redacted.replaceAll(sensitiveValue, '[REDACTED]'), value);

export const buildQuantumBackupDeployArgs = (endpoint: string, stackName: string, composePath: string) => [
  'stacks',
  'deploy',
  '-f',
  composePath,
  '--stack',
  stackName,
  '--endpoint',
  endpoint,
];

export const backupCommand = [
  'set -eu',
  'workdir="$(mktemp -d)"',
  'trap "rm -rf \"$workdir\"" EXIT',
  'dump="$workdir/backup.dump"',
  'download="$workdir/backup.download"',
  'checksum="$workdir/backup.sha256"',
  'export PGPASSWORD="$POSTGRES_PASSWORD"',
  'pg_dump --format=custom --no-owner --no-privileges --host "$POSTGRES_HOST" --port "$POSTGRES_PORT" --username "$POSTGRES_USER" --file "$dump" "$POSTGRES_DB"',
  'test -s "$dump"',
  'sha256sum "$dump" > "$checksum"',
  'aws --endpoint-url "$S3_ENDPOINT" s3 cp "$dump" "s3://$S3_BUCKET/$S3_OBJECT_KEY" --only-show-errors',
  'aws --endpoint-url "$S3_ENDPOINT" s3 cp "$checksum" "s3://$S3_BUCKET/$S3_OBJECT_KEY.sha256" --only-show-errors',
  'aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://$S3_BUCKET/$S3_OBJECT_KEY" "$download" --only-show-errors',
  'test -s "$download"',
  'test "$(wc -c < "$dump")" -eq "$(wc -c < "$download")"',
  'printf "%s  %s\\n" "$(cut -d " " -f1 "$checksum")" "$download" | sha256sum -c -',
  'pg_restore --list "$download" >/dev/null',
  'printf "backup_object=%s\\n" "$S3_OBJECT_KEY"',
  'printf "backup_sha256=%s\\n" "$(cut -d " " -f1 "$checksum")"',
].join('\n');

export const buildBackupComposeDocument = (
  migrate: Record<string, unknown>,
  input: { bucket: string; endpoint: string; internalNetwork: string; objectKey: string; sourceStack: string; accessKey: string; secretKey: string },
) => ({
  version: '3.8',
  services: {
    backup: {
      ...migrate,
      command: [backupCommand],
      entrypoint: ['sh', '-ec'],
      environment: { ...(migrate.environment as Record<string, unknown>), AWS_ACCESS_KEY_ID: input.accessKey, AWS_SECRET_ACCESS_KEY: input.secretKey, AWS_EC2_METADATA_DISABLED: 'true', S3_BUCKET: input.bucket, S3_ENDPOINT: input.endpoint, S3_OBJECT_KEY: input.objectKey, POSTGRES_HOST: `${input.sourceStack}_postgres` },
      networks: ['internal'],
      deploy: { ...((migrate.deploy as Record<string, unknown> | undefined) ?? {}), replicas: 1, restart_policy: { condition: 'none' } },
    },
  },
  networks: { internal: { external: true, name: input.internalNetwork } },
});

const main = async () => {
  process.umask(0o077);
  const environment = parseEnvironment(process.argv[2]);
  const runId = required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const attempt = required(process.env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT');
  const quantumEndpoint = required(process.env.QUANTUM_ENDPOINT, 'QUANTUM_ENDPOINT');
  const sourceStack = `studio-${environment}`;
  const bucket = backupBucketFor(environment);
  const objectKey = buildBackupObjectKey({
    attempt,
    deployImageDigest: required(process.env.DEPLOY_IMAGE_DIGEST, 'DEPLOY_IMAGE_DIGEST'),
    environment,
    runId,
    timestamp: new Date(),
  });
  const resultPath = resolve(process.env.RUNNER_TEMP ?? rootDir, `promote-backup-${runId}-${attempt}.json`);
  const projectDir = resolve(process.env.RUNNER_TEMP ?? rootDir, `promote-backup-${runId}-${attempt}`);
  const composePath = resolve(projectDir, 'docker-compose.json');
  const jobStack = `${sourceStack}-backup-gha-${runId}-${attempt}`.replace(/[^a-zA-Z0-9_.-]/gu, '-');
  const env = { ...process.env };

  required(process.env.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID');
  required(process.env.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY');
  required(process.env.S3_ENDPOINT, 'S3_ENDPOINT');
  if (!commandExists(rootDir, 'quantum-cli')) throw new Error('quantum-cli ist für den Backup-Job nicht verfügbar.');

  run(rootDir, 'mkdir', ['-p', projectDir]);
  try {
    const contract = await inspectRemoteServiceContract({ commandExists: (name) => commandExists(rootDir, name), runCapture: (name, args, requestEnv) => runCapture(rootDir, name, args, requestEnv) }, env, { quantumEndpoint, serviceName: 'app', stackName: sourceStack });
    const internalNetwork = pickInternalNetworkName(contract?.networkNames);
    if (!internalNetwork) throw new Error(`Das interne Live-Netz für ${sourceStack} konnte nicht ermittelt werden.`);
    const rendered = runCapture(rootDir, 'docker', ['compose', '-f', 'compose.yaml', '-f', `deploy/compose.${environment}.yaml`, 'config', '--format', 'json'], env);
    const compose = JSON.parse(rendered) as { services?: Record<string, Record<string, unknown>>; version?: string };
    const migrate = compose.services?.migrate;
    if (!migrate) throw new Error('Render-Compose enthält keinen migrate-Service als Basis für den Backup-Job.');
    const backupCompose = buildBackupComposeDocument(migrate, { accessKey: required(process.env.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'), bucket, endpoint: required(process.env.S3_ENDPOINT, 'S3_ENDPOINT'), internalNetwork, objectKey, secretKey: required(process.env.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY'), sourceStack });
    writeFileSync(composePath, `${JSON.stringify({ ...backupCompose, version: compose.version ?? backupCompose.version }, null, 2)}\n`);
    run(rootDir, 'quantum-cli', buildQuantumBackupDeployArgs(quantumEndpoint, jobStack, composePath), withoutDebugEnv(env));
    const deadline = Date.now() + Number(process.env.SVA_BACKUP_JOB_TIMEOUT_MS ?? '900000');
    for (;;) {
      const snapshot = runCaptureDetailed(rootDir, 'quantum-cli', ['ps', '--endpoint', quantumEndpoint, '--stack', jobStack, '--service', 'backup', '--all', '-o', 'json'], withoutDebugEnv(env));
      const payload = extractQuantumJsonPayload(`${snapshot.stdout}\n${snapshot.stderr}`.split('\n'));
      const task = payload ? selectLatestMigrationTask(collectQuantumTaskSnapshots(JSON.parse(payload) as unknown)) : null;
      const state = getMigrationJobTerminalState(task);
      if (state === 'succeeded') {
        writeFileSync(resultPath, `${JSON.stringify({ bucket, environment, objectKey, status: 'ok', taskId: task?.taskId }, null, 2)}\n`);
        if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `backup_bucket=${bucket}\nbackup_object=${objectKey}\nbackup_evidence_path=${resultPath}\n`);
        return;
      }
      if (state === 'failed') throw new Error(`Backup-Job ${jobStack} ist fehlgeschlagen (exitCode=${String(task?.exitCode)}).`);
      if (Date.now() >= deadline) throw new Error(`Backup-Job ${jobStack} hat das Timeout erreicht.`);
      await wait(2_000);
    }
  } finally {
    try { run(rootDir, 'quantum-cli', ['stacks', 'remove', '--force', '--endpoint', quantumEndpoint, '--stack', jobStack], withoutDebugEnv(env)); } catch { /* Cleanup darf den Primärfehler nicht überschreiben. */ }
    try { run(rootDir, 'rm', ['-rf', projectDir]); } catch { /* Cleanup darf den Primärfehler nicht überschreiben. */ }
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(redactBackupError(error instanceof Error ? error.message : String(error), [
      process.env.APP_CONFIG ?? '',
      process.env.S3_ACCESS_KEY_ID ?? '',
      process.env.S3_SECRET_ACCESS_KEY ?? '',
    ]));
    process.exitCode = 1;
  });
}
