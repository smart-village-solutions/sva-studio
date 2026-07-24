#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { commandExists, run, runCapture, runCaptureDetailed, wait, withoutDebugEnv } from '../ops/runtime/process.ts';
import {
  collectQuantumTaskSnapshots,
  getMigrationJobTerminalState,
  readRemoteJobLogTail,
  selectLatestMigrationTask,
  type MigrationJobTaskSnapshot,
} from '../ops/runtime/migration-job.ts';
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
    .reduce((redacted, sensitiveValue) => redacted.replaceAll(sensitiveValue, '[REDACTED]'), value)
    .replace(/((?:password|token|secret|authorization)\s*[=:]\s*)[^\s]+/giu, '$1[REDACTED]')
    .slice(-8_000);

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
  'backup_step() {',
  '  step="$1"',
  '  shift',
  '  printf "backup.step=%s state=started\\n" "$step"',
  '  if "$@"; then',
  '    printf "backup.step=%s state=succeeded\\n" "$step"',
  '  else',
  '    status="$?"',
  '    printf "backup.step=%s state=failed exit_code=%s\\n" "$step" "$status" >&2',
  '    return "$status"',
  '  fi',
  '}',
  'workdir="$(mktemp -d)"',
  'trap "rm -rf \"$workdir\"" EXIT',
  'dump="$workdir/backup.dump"',
  'download="$workdir/backup.download"',
  'checksum="$workdir/backup.sha256"',
  'export PGPASSWORD="$POSTGRES_PASSWORD"',
  'backup_step pg_dump pg_dump --format=custom --no-owner --no-privileges --host "$POSTGRES_HOST" --port "$POSTGRES_PORT" --username "$POSTGRES_USER" --file "$dump" "$POSTGRES_DB"',
  'backup_step dump_nonempty test -s "$dump"',
  "backup_step checksum_create sh -c 'sha256sum \"$1\" > \"$2\"' -- \"$dump\" \"$checksum\"",
  'backup_step minio_upload_dump aws --endpoint-url "$S3_ENDPOINT" s3 cp "$dump" "s3://$S3_BUCKET/$S3_OBJECT_KEY" --only-show-errors',
  'backup_step minio_upload_checksum aws --endpoint-url "$S3_ENDPOINT" s3 cp "$checksum" "s3://$S3_BUCKET/$S3_OBJECT_KEY.sha256" --only-show-errors',
  'backup_step minio_download_dump aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://$S3_BUCKET/$S3_OBJECT_KEY" "$download" --only-show-errors',
  'backup_step download_nonempty test -s "$download"',
  "backup_step size_verify sh -c 'test \"$(wc -c < \"$1\")\" -eq \"$(wc -c < \"$2\")\"' -- \"$dump\" \"$download\"",
  "backup_step checksum_verify sh -c 'printf \"%s  %s\\n\" \"$(cut -d \" \" -f1 \"$1\")\" \"$2\" | sha256sum -c -' -- \"$checksum\" \"$download\"",
  "backup_step archive_validate sh -c 'pg_restore --list \"$1\" >/dev/null' -- \"$download\"",
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

export const buildBackupEvidence = ({
  bucket,
  environment,
  error,
  logTail,
  objectKey,
  status,
  task,
}: {
  bucket: string;
  environment: PromoteEnvironment;
  error?: string;
  logTail?: string;
  objectKey: string;
  status: 'failed' | 'ok' | 'timed_out';
  task?: MigrationJobTaskSnapshot | null;
}) => ({
  bucket,
  environment,
  error,
  logTail,
  objectKey,
  status,
  task: task
    ? {
      exitCode: task.exitCode,
      state: task.state,
      taskId: task.taskId,
    }
    : undefined,
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
  const sensitiveValues = [
    process.env.APP_CONFIG ?? '',
    process.env.S3_ACCESS_KEY_ID ?? '',
    process.env.S3_SECRET_ACCESS_KEY ?? '',
  ];
  let latestTask: MigrationJobTaskSnapshot | null = null;

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
      latestTask = payload ? selectLatestMigrationTask(collectQuantumTaskSnapshots(JSON.parse(payload) as unknown)) : null;
      const state = getMigrationJobTerminalState(latestTask);
      if (state === 'succeeded') {
        writeFileSync(resultPath, `${JSON.stringify(buildBackupEvidence({ bucket, environment, objectKey, status: 'ok', task: latestTask }), null, 2)}\n`);
        if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `backup_bucket=${bucket}\nbackup_object=${objectKey}\nbackup_evidence_path=${resultPath}\n`);
        return;
      }
      if (state === 'failed') throw new Error(`Backup-Job ${jobStack} ist fehlgeschlagen (exitCode=${String(latestTask?.exitCode)}).`);
      if (Date.now() >= deadline) throw new Error(`Backup-Job ${jobStack} hat das Timeout erreicht.`);
      await wait(2_000);
    }
  } catch (error) {
    const remoteLogTail = await readRemoteJobLogTail(
      { commandExists, rootDir, runCapture },
      env,
      {
        containerId: latestTask?.containerId,
        quantumEndpoint,
        serviceId: latestTask?.serviceId,
      },
    );
    const errorText = redactBackupError(error instanceof Error ? error.message : String(error), sensitiveValues);
    writeFileSync(resultPath, `${JSON.stringify(buildBackupEvidence({
      bucket,
      environment,
      error: errorText,
      logTail: redactBackupError(remoteLogTail, sensitiveValues),
      objectKey,
      status: errorText.includes('Timeout') ? 'timed_out' : 'failed',
      task: latestTask,
    }), null, 2)}\n`);
    throw error;
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
