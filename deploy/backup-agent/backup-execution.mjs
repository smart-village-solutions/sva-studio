import { discoverWasteInventory } from './database-operations.mjs';
import {
  operationState,
  targets,
  resolveDatabaseTarget,
  deriveWasteInventoryTarget,
  controlKeysFor,
} from './runtime-config.mjs';
import {
  required,
  readSecret,
  runCommand,
  s3Env,
  uploadJson,
  sha256,
  safeErrorCode,
} from './runtime-io.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const transferAndVerifyBackup = async ({
  target,
  workdir,
  dump,
  downloaded,
  objectKey,
  steps,
  complete,
  evidence,
}) => {
  await mkdir(workdir, { recursive: true, mode: 0o700 });
  const pgEnv = { ...process.env, PGPASSWORD: await readSecret(target.postgresPasswordFile) };
  await runCommand('pg_dump', backupDumpArgs(target, dump), { env: pgEnv });
  complete('pg_dump');
  const env = await s3Env(target);
  const endpoint = required(process.env.BACKUP_S3_ENDPOINT, 'BACKUP_S3_ENDPOINT');
  await runCommand(
    'aws',
    [
      '--endpoint-url',
      endpoint,
      's3',
      'cp',
      dump,
      `s3://${target.bucket}/${objectKey}`,
      '--only-show-errors',
    ],
    { env }
  );
  complete('upload');
  await runCommand(
    'aws',
    [
      '--endpoint-url',
      endpoint,
      's3',
      'cp',
      `s3://${target.bucket}/${objectKey}`,
      downloaded,
      '--only-show-errors',
    ],
    { env }
  );
  complete('download');
  const dumpDigest = await sha256(dump);
  if (dumpDigest !== (await sha256(downloaded))) throw new Error('checksum_mismatch');
  const bytes = (await stat(dump)).size;
  complete('size-and-checksum-verify', { bytes, sha256: dumpDigest });
  await writeFile(`${dump}.sha256`, `${dumpDigest}  backup.dump\n`, { mode: 0o600 });
  await runCommand(
    'aws',
    [
      '--endpoint-url',
      endpoint,
      's3',
      'cp',
      `${dump}.sha256`,
      `s3://${target.bucket}/${objectKey}.sha256`,
      '--only-show-errors',
    ],
    { env }
  );
  await runCommand('pg_restore', ['--list', downloaded]);
  complete('archive-validate');
  const result = {
    ...evidence,
    status: 'succeeded',
    objectKey,
    bytes,
    sha256: dumpDigest,
    steps,
    completedAt: new Date().toISOString(),
  };
  return result;
};

export const backupDumpArgs = (target, dump) => [
  '--format=custom',
  '--no-owner',
  '--no-privileges',
  ...(target.database === 'waste' ? ['--role', target.schemaOwner] : []),
  '--host',
  target.postgresHost,
  '--port',
  '5432',
  '--username',
  target.postgresUser,
  '--file',
  dump,
  target.postgresDatabase,
];

const executeBackupTargetForIntegration = async (request, target) => {
  const workdir = join(tmpdir(), `backup-agent-${request.requestId}-${randomUUID()}`);
  const dump = join(workdir, 'backup.dump');
  const downloaded = join(workdir, 'backup.download');
  const digest = request.deployImageDigest.slice('sha256:'.length);
  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
  const objectKey = `${target.prefix}/${timestamp}/${digest}/${request.requestId}.dump`;
  const steps = [];
  const complete = (step, details = {}) => steps.push({ step, status: 'succeeded', ...details });
  const evidence = {
    version: 1,
    requestId: request.requestId,
    environment: request.environment,
    database: target.database,
    ...(target.tenantInstanceId
      ? {
          tenantInstanceId: target.tenantInstanceId,
          databaseName: target.sourceDatabase,
        }
      : {}),
    deployImageDigest: request.deployImageDigest,
    agentImage: required(process.env.BACKUP_AGENT_IMAGE_REF, 'BACKUP_AGENT_IMAGE_REF'),
    tools: JSON.parse(
      required(process.env.BACKUP_AGENT_TOOL_VERSIONS, 'BACKUP_AGENT_TOOL_VERSIONS')
    ),
  };
  try {
    return await transferAndVerifyBackup({
      target,
      workdir,
      dump,
      downloaded,
      objectKey,
      steps,
      complete,
      evidence,
    });
  } catch (error) {
    return {
      ...evidence,
      status: 'failed',
      errorCode: safeErrorCode(error),
      steps,
      completedAt: new Date().toISOString(),
    };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
};

export const executeBackupForIntegration = async (request) => {
  const controlTarget = targets[request.environment];
  const resultKey = controlKeysFor(request.requestId).result;
  try {
    if (request.database !== 'waste') {
      const result = await executeBackupTargetForIntegration(
        request,
        resolveDatabaseTarget(request.environment, request.database ?? 'studio')
      );
      await uploadJson(controlTarget, resultKey, result);
      return;
    }

    const inventory = await discoverWasteInventory(request.environment, request.tenantInstanceId);
    const backups = [];
    for (const item of inventory) {
      backups.push(
        await executeBackupTargetForIntegration(
          request,
          deriveWasteInventoryTarget(request.environment, item)
        )
      );
    }
    const succeeded = backups.every((backup) => backup.status === 'succeeded');
    const manifest = {
      version: 1,
      requestId: request.requestId,
      environment: request.environment,
      database: 'waste',
      deployImageDigest: request.deployImageDigest,
      status: succeeded ? 'succeeded' : 'failed',
      inventoryCount: inventory.length,
      backups,
      completedAt: new Date().toISOString(),
    };
    const manifestBody = `${JSON.stringify(manifest)}\n`;
    const manifestKey = `${controlTarget.prefix}/waste/inventory/${request.requestId}.json`;
    await uploadJson(controlTarget, manifestKey, manifest);
    await uploadJson(controlTarget, resultKey, {
      ...manifest,
      objectKey: manifestKey,
      bytes: Buffer.byteLength(manifestBody),
      sha256: createHash('sha256').update(manifestBody).digest('hex'),
      steps: [{ step: 'tenant-inventory-backups', status: succeeded ? 'succeeded' : 'failed' }],
    });
  } catch (error) {
    await uploadJson(controlTarget, resultKey, {
      version: 1,
      requestId: request.requestId,
      environment: request.environment,
      database: request.database ?? 'studio',
      deployImageDigest: request.deployImageDigest,
      status: 'failed',
      errorCode: safeErrorCode(error),
      steps: [],
      completedAt: new Date().toISOString(),
    });
  } finally {
    operationState.terminalRequests.add(request.requestId);
    operationState.active = false;
  }
};
