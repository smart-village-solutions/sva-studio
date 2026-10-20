import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const acceptanceCommandTimeoutMs = 10_000;

export const minioAwsCompatibilityEnv = {
  AWS_REQUEST_CHECKSUM_CALCULATION: 'when_required',
  AWS_RESPONSE_CHECKSUM_VALIDATION: 'when_required',
};

export const required = (value, name) => {
  const result = value?.trim();
  if (!result) throw new Error(`${name} is required`);
  return result;
};

export const readSecret = async (name) =>
  (await readFile(required(process.env[name], name), 'utf8')).trim();

export const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const { timeoutMs, ...spawnOptions } = options;
    const child = spawn(command, args, { ...spawnOptions, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      callback();
    };
    const timeoutTimer = timeoutMs
      ? setTimeout(() => {
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 1_000).unref();
          finish(() => reject(new Error(`${command}_timeout`)));
        }, timeoutMs)
      : undefined;
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2_000);
    });
    child.once('error', (error) => finish(() => reject(error)));
    child.once('exit', (code) =>
      finish(() =>
        code === 0
          ? resolve()
          : reject(
              new Error(`${command}_failed_${String(code)}:${stderr.replaceAll(/\s+/gu, ' ')}`)
            )
      )
    );
  });

export const runCapture = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const { maxOutputBytes = 1_000, ...spawnOptions } = options;
    const child = spawn(command, args, { ...spawnOptions, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-maxOutputBytes);
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-maxOutputBytes);
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve(stdout.trim() || stderr.trim())
        : reject(new Error(`${command}_preflight_failed_${String(code)}`))
    );
  });

export const s3Env = async (target) => ({
  ...process.env,
  AWS_ACCESS_KEY_ID: await readSecret(target.s3AccessKeyFile),
  AWS_SECRET_ACCESS_KEY: await readSecret(target.s3SecretKeyFile),
  AWS_EC2_METADATA_DISABLED: 'true',
  AWS_DEFAULT_REGION: 'us-east-1',
  AWS_MAX_ATTEMPTS: '2',
  AWS_RETRY_MODE: 'standard',
  ...minioAwsCompatibilityEnv,
});

export const uploadJson = async (target, key, value) => {
  const path = join(tmpdir(), `backup-agent-${randomUUID()}.json`);
  await writeFile(path, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  try {
    await runCommand(
      'aws',
      [
        '--endpoint-url',
        required(process.env.BACKUP_S3_ENDPOINT, 'BACKUP_S3_ENDPOINT'),
        's3',
        'cp',
        path,
        `s3://${target.bucket}/${key}`,
        '--only-show-errors',
      ],
      { env: await s3Env(target), timeoutMs: acceptanceCommandTimeoutMs }
    );
  } finally {
    await rm(path, { force: true });
  }
};

export const objectExists = async (target, key) => {
  try {
    await runCommand(
      'aws',
      [
        '--endpoint-url',
        required(process.env.BACKUP_S3_ENDPOINT, 'BACKUP_S3_ENDPOINT'),
        's3api',
        'head-object',
        '--bucket',
        target.bucket,
        '--key',
        key,
      ],
      { env: await s3Env(target), timeoutMs: acceptanceCommandTimeoutMs }
    );
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('aws_failed_254:')) return false;
    throw error;
  }
};

export const sha256 = (path) =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });

export const safeErrorCode = (error) => {
  const message = error instanceof Error ? error.message : '';
  if (
    [
      'checksum_mismatch',
      'active_app_sessions',
      'archive_schema_incompatible',
      'schema_version_mismatch',
      'database_postcheck_failed',
      'runtime_principal_reconciliation_failed',
      'runtime_principal_probe_failed',
      'waste_inventory_invalid',
      'waste_inventory_request_invalid',
      'waste_inventory_tenant_not_found',
      'waste_inventory_target_invalid',
      'waste_restore_target_invalid',
      'waste_import_target_not_empty',
      'waste_import_inventory_mismatch',
      'waste_import_backfill_mismatch',
    ].includes(message)
  )
    return message;
  const commandFailure =
    /^(aws|pg_dump|pg_restore|psql)_(?:(?:preflight_)?failed_[0-9]+|timeout)/u.exec(message);
  return commandFailure?.[0] ?? 'backup_failed';
};

export const postgresArgs = (target) => [
  '--host',
  target.postgresHost,
  '--port',
  '5432',
  '--username',
  target.restoreUser,
  '--dbname',
  target.postgresDatabase,
];

export const runSql = async (target, pgEnv, sql) =>
  runCapture(
    'psql',
    [
      ...postgresArgs(target),
      '--no-psqlrc',
      '--tuples-only',
      '--no-align',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      sql,
    ],
    { env: pgEnv }
  );
