import {
  createHash,
  createHmac,
  createPublicKey,
  randomUUID,
  timingSafeEqual,
  verify as verifySignature,
} from 'node:crypto';
import { createServer } from 'node:http';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { finished } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

const requestPath = '/_ops/backup/v1/requests';
const restoreRequestPath = '/_ops/restore/v1/requests';
const oidcIssuer = 'https://token.actions.githubusercontent.com';
const jwksUrl = `${oidcIssuer}/.well-known/jwks`;
const maxBodyBytes = 16_384;
const maxRequestLifetimeMs = 10 * 60_000;
const acceptanceCommandTimeoutMs = 10_000;
export const minioAwsCompatibilityEnv = {
  AWS_REQUEST_CHECKSUM_CALCULATION: 'when_required',
  AWS_RESPONSE_CHECKSUM_VALIDATION: 'when_required',
};

const required = (value, name) => {
  const result = value?.trim();
  if (!result) throw new Error(`${name} is required`);
  return result;
};

const readSecret = async (name) =>
  (await readFile(required(process.env[name], name), 'utf8')).trim();

export const targets = {
  staging: {
    host: 'backup-studio-staging.smart-village.app',
    bucket: 'studio-db-backup-staging',
    prefix: 'staging',
    postgresHost: 'studio-staging_postgres',
    postgresDatabase: process.env.BACKUP_STAGING_POSTGRES_DB || 'sva_studio',
    postgresUser: process.env.BACKUP_STAGING_POSTGRES_USER || 'sva',
    postgresPasswordFile: 'BACKUP_STAGING_POSTGRES_PASSWORD_FILE',
    s3AccessKeyFile: 'BACKUP_STAGING_S3_ACCESS_KEY_FILE',
    s3SecretKeyFile: 'BACKUP_STAGING_S3_SECRET_KEY_FILE',
    signingKeyFile: 'BACKUP_STAGING_SIGNING_KEY_FILE',
    restoreSigningKeyFile: 'RESTORE_STAGING_SIGNING_KEY_FILE',
    restoreUser: process.env.RESTORE_STAGING_POSTGRES_USER || 'sva_restore',
    restorePasswordFile: 'RESTORE_STAGING_POSTGRES_PASSWORD_FILE',
    schemaOwner: 'sva',
    runtimeRole: 'iam_app',
    runtimeUser: 'sva_app',
  },
  prod: {
    host: 'backup-studio.smart-village.app',
    bucket: 'studio-db-backup-production',
    prefix: 'prod',
    postgresHost: 'studio_postgres',
    postgresDatabase: process.env.BACKUP_PROD_POSTGRES_DB || 'sva_studio',
    postgresUser: process.env.BACKUP_PROD_POSTGRES_USER || 'sva',
    postgresPasswordFile: 'BACKUP_PROD_POSTGRES_PASSWORD_FILE',
    s3AccessKeyFile: 'BACKUP_PROD_S3_ACCESS_KEY_FILE',
    s3SecretKeyFile: 'BACKUP_PROD_S3_SECRET_KEY_FILE',
    signingKeyFile: 'BACKUP_PROD_SIGNING_KEY_FILE',
    restoreSigningKeyFile: 'RESTORE_PROD_SIGNING_KEY_FILE',
    restoreUser: process.env.RESTORE_PROD_POSTGRES_USER || 'sva_restore',
    restorePasswordFile: 'RESTORE_PROD_POSTGRES_PASSWORD_FILE',
    schemaOwner: 'sva',
    runtimeRole: 'iam_app',
    runtimeUser: 'sva_app',
  },
};

export const validRequestHost = (environment, host) => targets[environment]?.host === host;

export const canonicalRequest = (request) =>
  JSON.stringify({
    action: request.action,
    deployImageDigest: request.deployImageDigest,
    environment: request.environment,
    expiresAt: request.expiresAt,
    maintenanceWindowReference: request.maintenanceWindowReference ?? null,
    requestId: request.requestId,
    version: request.version,
  });

export const canonicalRestoreRequest = (request) =>
  JSON.stringify({
    action: request.action,
    environment: request.environment,
    expiresAt: request.expiresAt,
    maintenanceWindowReference: request.maintenanceWindowReference,
    requestId: request.requestId,
    sourceObjectKey: request.sourceObjectKey,
    sourceSha256: request.sourceSha256,
    version: request.version,
  });

export const validRequest = (request, now = Date.now()) => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return false;
  const allowedKeys = new Set([
    'action',
    'deployImageDigest',
    'environment',
    'expiresAt',
    'maintenanceWindowReference',
    'requestId',
    'version',
  ]);
  if (Object.keys(request).some((key) => !allowedKeys.has(key))) return false;
  if (request.version !== 1 || request.action !== 'backup-and-verify') return false;
  if (request.environment !== 'staging' && request.environment !== 'prod') return false;
  if (
    typeof request.requestId !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,127}$/u.test(request.requestId)
  )
    return false;
  if (
    typeof request.deployImageDigest !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/u.test(request.deployImageDigest)
  )
    return false;
  const expiresAt =
    typeof request.expiresAt === 'string' ? Date.parse(request.expiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + maxRequestLifetimeMs)
    return false;
  return (
    request.environment !== 'prod' ||
    (typeof request.maintenanceWindowReference === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9._:/# -]{2,159}$/u.test(request.maintenanceWindowReference))
  );
};

export const validRestoreRequest = (request, now = Date.now()) => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return false;
  const allowedKeys = new Set([
    'action',
    'environment',
    'expiresAt',
    'maintenanceWindowReference',
    'requestId',
    'sourceObjectKey',
    'sourceSha256',
    'version',
  ]);
  if (Object.keys(request).some((key) => !allowedKeys.has(key))) return false;
  if (request.version !== 1 || request.action !== 'restore-and-verify-v1') return false;
  if (request.environment !== 'staging' && request.environment !== 'prod') return false;
  if (
    typeof request.requestId !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,127}$/u.test(request.requestId)
  )
    return false;
  if (
    typeof request.maintenanceWindowReference !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/# -]{2,159}$/u.test(request.maintenanceWindowReference)
  )
    return false;
  if (typeof request.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(request.sourceSha256))
    return false;
  const prefix = `${targets[request.environment].prefix}/`;
  if (
    typeof request.sourceObjectKey !== 'string' ||
    !request.sourceObjectKey.startsWith(prefix) ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{7,511}\.dump$/u.test(request.sourceObjectKey) ||
    request.sourceObjectKey.includes('..')
  )
    return false;
  const expiresAt =
    typeof request.expiresAt === 'string' ? Date.parse(request.expiresAt) : Number.NaN;
  return Number.isFinite(expiresAt) && expiresAt > now && expiresAt <= now + maxRequestLifetimeMs;
};

const decodeBase64Url = (value) => Buffer.from(value, 'base64url');

let jwksCache;
const getJwks = async () => {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch(jwksUrl, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error('oidc_jwks_unavailable');
  const document = await response.json();
  if (!Array.isArray(document.keys)) throw new Error('oidc_jwks_invalid');
  jwksCache = { keys: document.keys, expiresAt: Date.now() + 5 * 60_000 };
  return document.keys;
};

export const validateOidcClaims = (
  claims,
  environment,
  now = Math.floor(Date.now() / 1_000),
  action = 'backup-and-verify'
) => {
  if (
    claims.iss !== oidcIssuer ||
    claims.aud !== required(process.env.BACKUP_AGENT_OIDC_AUDIENCE, 'BACKUP_AGENT_OIDC_AUDIENCE')
  )
    throw new Error('oidc_claims_invalid');
  if (
    typeof claims.exp !== 'number' ||
    typeof claims.nbf !== 'number' ||
    claims.exp <= now ||
    claims.nbf > now
  )
    throw new Error('oidc_time_invalid');
  if (
    claims.repository !==
    required(process.env.BACKUP_AGENT_GITHUB_REPOSITORY, 'BACKUP_AGENT_GITHUB_REPOSITORY')
  )
    throw new Error('oidc_repository_invalid');
  if (claims.environment !== environment) throw new Error('oidc_environment_invalid');
  const workflowVariable =
    action === 'restore-and-verify-v1'
      ? 'RESTORE_AGENT_ALLOWED_WORKFLOWS'
      : 'BACKUP_AGENT_ALLOWED_WORKFLOWS';
  const allowedWorkflows = required(process.env[workflowVariable], workflowVariable)
    .split(',')
    .map((value) => `${claims.repository}/.github/workflows/${value.trim()}@refs/heads/main`);
  const workflowReferences = [claims.workflow_ref, claims.job_workflow_ref].filter(
    (value) => typeof value === 'string'
  );
  if (!workflowReferences.some((value) => allowedWorkflows.includes(value)))
    throw new Error('oidc_workflow_invalid');
};

const verifyOidc = async (token, environment, action) => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('oidc_token_invalid');
  const header = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'));
  const claims = JSON.parse(decodeBase64Url(parts[1]).toString('utf8'));
  if (header.alg !== 'RS256' || typeof header.kid !== 'string')
    throw new Error('oidc_header_invalid');
  const key = (await getJwks()).find((candidate) => candidate.kid === header.kid);
  if (!key) throw new Error('oidc_key_unknown');
  const valid = verifySignature(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey({ key, format: 'jwk' }),
    decodeBase64Url(parts[2])
  );
  if (!valid) throw new Error('oidc_signature_invalid');
  validateOidcClaims(claims, environment, Math.floor(Date.now() / 1_000), action);
};

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

const runCapture = (command, args, options = {}) =>
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

const s3Env = async (target) => ({
  ...process.env,
  AWS_ACCESS_KEY_ID: await readSecret(target.s3AccessKeyFile),
  AWS_SECRET_ACCESS_KEY: await readSecret(target.s3SecretKeyFile),
  AWS_EC2_METADATA_DISABLED: 'true',
  AWS_DEFAULT_REGION: 'us-east-1',
  AWS_MAX_ATTEMPTS: '2',
  AWS_RETRY_MODE: 'standard',
  ...minioAwsCompatibilityEnv,
});

const uploadJson = async (target, key, value) => {
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

const objectExists = async (target, key) => {
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

const sha256 = (path) =>
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
    ].includes(message)
  )
    return message;
  const commandFailure =
    /^(aws|pg_dump|pg_restore|psql)_(?:(?:preflight_)?failed_[0-9]+|timeout)/u.exec(message);
  return commandFailure?.[0] ?? 'backup_failed';
};

let active = false;
const terminalRequests = new Set();

export const controlKeysFor = (requestId) => ({
  request: `control/requests/${requestId}.json`,
  result: `control/results/${requestId}.json`,
});

export const restoreControlKeysFor = (requestId) => ({
  request: `control/restores/requests/${requestId}.json`,
  safetyBackup: `control/restores/safety-backups/${requestId}.json`,
  result: `control/restores/results/${requestId}.json`,
});

export const executeBackupForIntegration = async (request) => {
  const target = targets[request.environment];
  const workdir = join(tmpdir(), `backup-agent-${request.requestId}-${randomUUID()}`);
  const dump = join(workdir, 'backup.dump');
  const downloaded = join(workdir, 'backup.download');
  const digest = request.deployImageDigest.slice('sha256:'.length);
  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
  const objectKey = `${target.prefix}/${timestamp}/${digest}/${request.requestId}.dump`;
  const resultKey = controlKeysFor(request.requestId).result;
  const steps = [];
  const complete = (step, details = {}) => steps.push({ step, status: 'succeeded', ...details });
  const evidence = {
    version: 1,
    requestId: request.requestId,
    environment: request.environment,
    deployImageDigest: request.deployImageDigest,
    agentImage: required(process.env.BACKUP_AGENT_IMAGE_REF, 'BACKUP_AGENT_IMAGE_REF'),
    tools: JSON.parse(
      required(process.env.BACKUP_AGENT_TOOL_VERSIONS, 'BACKUP_AGENT_TOOL_VERSIONS')
    ),
  };
  try {
    await mkdir(workdir, { recursive: true, mode: 0o700 });
    const pgEnv = { ...process.env, PGPASSWORD: await readSecret(target.postgresPasswordFile) };
    await runCommand(
      'pg_dump',
      [
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '--host',
        target.postgresHost,
        '--port',
        '5432',
        '--username',
        target.postgresUser,
        '--file',
        dump,
        target.postgresDatabase,
      ],
      { env: pgEnv }
    );
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
    await uploadJson(target, resultKey, {
      ...evidence,
      status: 'succeeded',
      objectKey,
      bytes,
      sha256: dumpDigest,
      steps,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    await uploadJson(target, resultKey, {
      ...evidence,
      status: 'failed',
      errorCode: safeErrorCode(error),
      steps,
      completedAt: new Date().toISOString(),
    });
  } finally {
    terminalRequests.add(request.requestId);
    active = false;
    await rm(workdir, { recursive: true, force: true });
  }
};

const postgresArgs = (target) => [
  '--host',
  target.postgresHost,
  '--port',
  '5432',
  '--username',
  target.restoreUser,
  '--dbname',
  target.postgresDatabase,
];

const runSql = async (target, pgEnv, sql) =>
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

const sqlIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;
const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;

const assertRuntimePrincipalTarget = (target) => {
  const allowlisted = Object.values(targets).some(
    (candidate) =>
      candidate.postgresDatabase === target.postgresDatabase &&
      candidate.postgresHost === target.postgresHost &&
      candidate.runtimeRole === target.runtimeRole &&
      candidate.runtimeUser === target.runtimeUser &&
      candidate.schemaOwner === target.schemaOwner
  );
  if (!allowlisted) throw new Error('runtime_principal_target_invalid');
};

export const buildRuntimePrincipalReconciliationSql = (target) => {
  assertRuntimePrincipalTarget(target);
  const database = sqlIdentifier(target.postgresDatabase);
  const runtimeRole = sqlIdentifier(target.runtimeRole);
  const runtimeUser = sqlIdentifier(target.runtimeUser);
  const schemaOwner = sqlIdentifier(target.schemaOwner);
  return `
DO $restore_principal_guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(target.schemaOwner)})
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(target.runtimeRole)})
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(target.runtimeUser)}) THEN
    RAISE EXCEPTION 'restore_runtime_principal_missing';
  END IF;
END
$restore_principal_guard$;

SET ROLE ${schemaOwner};
GRANT ${runtimeRole} TO ${runtimeUser};
GRANT CONNECT ON DATABASE ${database} TO ${runtimeUser};
GRANT USAGE ON SCHEMA iam TO ${runtimeUser};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO ${runtimeUser};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO ${runtimeUser};
RESET ROLE;
`;
};

const runtimePrincipalProbeSql = (target) => {
  assertRuntimePrincipalTarget(target);
  const database = sqlLiteral(target.postgresDatabase);
  const runtimeRole = sqlLiteral(target.runtimeRole);
  const runtimeUser = sqlLiteral(target.runtimeUser);
  return `
SELECT json_build_object(
  'accountSelect', has_table_privilege(
    ${runtimeUser},
    (SELECT relation.oid FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace WHERE namespace.nspname = 'iam' AND relation.relname = 'accounts'),
    'SELECT'
  ),
  'databaseConnect', has_database_privilege(${runtimeUser}, ${database}, 'CONNECT'),
  'instancesSelect', has_table_privilege(
    ${runtimeUser},
    (SELECT relation.oid FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace WHERE namespace.nspname = 'iam' AND relation.relname = 'instances'),
    'SELECT'
  ),
  'permissionsSelect', has_table_privilege(
    ${runtimeUser},
    (SELECT relation.oid FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace WHERE namespace.nspname = 'iam' AND relation.relname = 'permissions'),
    'SELECT'
  ),
  'roleMembership', pg_has_role(${runtimeUser}, ${runtimeRole}, 'MEMBER'),
  'schemaUsage', has_schema_privilege(${runtimeUser}, 'iam', 'USAGE'),
  'sequencesReady', COALESCE(
    (
      SELECT bool_and(has_sequence_privilege(${runtimeUser}, sequence.oid, 'USAGE,SELECT'))
      FROM pg_class sequence
      JOIN pg_namespace namespace ON namespace.oid = sequence.relnamespace
      WHERE namespace.nspname = 'iam' AND sequence.relkind = 'S'
    ),
    true
  )
)::text;
`;
};

export const validateRuntimePrincipalProbe = (probe) => {
  const requiredChecks = [
    'accountSelect',
    'databaseConnect',
    'instancesSelect',
    'permissionsSelect',
    'roleMembership',
    'schemaUsage',
    'sequencesReady',
  ];
  if (!probe || typeof probe !== 'object' || requiredChecks.some((check) => probe[check] !== true))
    throw new Error('runtime_principal_probe_failed');
  return Object.fromEntries(requiredChecks.map((check) => [check, true]));
};

const reconcileAndProbeRuntimePrincipal = async (target, pgEnv) => {
  try {
    await runSql(target, pgEnv, buildRuntimePrincipalReconciliationSql(target));
  } catch {
    throw new Error('runtime_principal_reconciliation_failed');
  }
  try {
    const output = await runSql(target, pgEnv, runtimePrincipalProbeSql(target));
    const payload = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    return validateRuntimePrincipalProbe(JSON.parse(payload ?? 'null'));
  } catch (error) {
    if (error instanceof Error && error.message === 'runtime_principal_probe_failed') throw error;
    throw new Error('runtime_principal_probe_failed');
  }
};

const runSqlAsSchemaOwner = async (target, pgEnv, sql) => {
  const output = await runSql(
    target,
    pgEnv,
    `SET ROLE ${sqlIdentifier(target.schemaOwner)}; ${sql}`
  );
  return (
    output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1) ?? ''
  );
};

export const waitForSessionDrain = async (
  target,
  pgEnv,
  {
    attempts = 30,
    readActiveSessions = () =>
      runSql(
        target,
        pgEnv,
        `SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND usename = ${sqlLiteral(target.runtimeUser)} AND backend_type = 'client backend' AND pid <> pg_backend_pid()`
      ),
    wait = () => new Promise((resolveWait) => setTimeout(resolveWait, 2_000)),
  } = {}
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const activeSessions = Number(await readActiveSessions());
    if (Number.isInteger(activeSessions) && activeSessions === 0) return;
    if (attempt < attempts - 1) await wait();
  }
  throw new Error('active_app_sessions');
};

export const validateDatabasePostchecks = ({
  appPrincipal,
  gooseVersion,
  iamSchema,
  registryEntries,
}) => {
  if (
    !/^\d+$/u.test(gooseVersion) ||
    iamSchema !== 't' ||
    appPrincipal !== '1' ||
    !/^\d+$/u.test(registryEntries)
  )
    throw new Error('database_postcheck_failed');
};

export const archiveSchemaCompatible = (listing) =>
  listing.includes('TABLE public goose_db_version') && listing.includes('TABLE iam instances');

export const isRestoreSqlLineSupported = (line) => line !== 'SET transaction_timeout = 0;';

const writeCompatibleRestoreSql = async (source, target) => {
  const input = createReadStream(source);
  const output = createWriteStream(target, { mode: 0o600 });
  try {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      if (isRestoreSqlLineSupported(line) && !output.write(`${line}\n`)) {
        await once(output, 'drain');
      }
    }
    output.end();
    await finished(output);
  } catch (error) {
    output.destroy();
    throw error;
  }
};

export const extractAppliedGooseVersion = (sql) => {
  const lines = sql.split('\n');
  const copyIndex = lines.findIndex((line) => line.startsWith('COPY public.goose_db_version ('));
  if (copyIndex < 0) return null;
  const columns = /^COPY public\.goose_db_version \(([^)]+)\) FROM stdin;$/u
    .exec(lines[copyIndex])?.[1]
    .split(', ')
    .map((column) => column.replaceAll('"', ''));
  if (!columns) return null;
  const versionIndex = columns.indexOf('version_id');
  const appliedIndex = columns.indexOf('is_applied');
  if (versionIndex < 0 || appliedIndex < 0) return null;
  const appliedVersions = lines
    .slice(copyIndex + 1, lines.indexOf('\\.', copyIndex + 1))
    .map((line) => line.split('\t'))
    .filter((values) => values[appliedIndex] === 't' || values[appliedIndex] === 'true')
    .map((values) => values[versionIndex])
    .filter((value) => /^\d+$/u.test(value))
    .map(Number);
  return appliedVersions.length > 0 ? Math.max(...appliedVersions) : null;
};

export const isHistoricalSchemaRestoreCompatible = (sourceGooseVersion, targetGooseVersion) =>
  Number.isSafeInteger(sourceGooseVersion) &&
  Number.isSafeInteger(targetGooseVersion) &&
  sourceGooseVersion <= targetGooseVersion;

export const restoreSchemaResetSql = (schemaOwner) => {
  const owner = sqlIdentifier(schemaOwner);
  return `SET ROLE ${owner}; DROP SCHEMA IF EXISTS iam CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION ${owner}; CREATE SCHEMA iam AUTHORIZATION ${owner};`;
};

const verifyArchiveSchema = async (archive) => {
  const listing = await runCapture('pg_restore', ['--list', archive], {
    maxOutputBytes: 10 * 1024 * 1024,
  });
  if (!archiveSchemaCompatible(listing)) throw new Error('archive_schema_incompatible');
};

const readArchiveGooseVersion = async (archive) => {
  const sql = await runCapture(
    'pg_restore',
    ['--data-only', '--table', 'goose_db_version', '--file', '-', archive],
    { maxOutputBytes: 2 * 1024 * 1024 }
  );
  return extractAppliedGooseVersion(sql);
};

export const executeRestoreForIntegration = async (request) => {
  const target = targets[request.environment];
  const keys = restoreControlKeysFor(request.requestId);
  const workdir = join(tmpdir(), `restore-agent-${request.requestId}-${randomUUID()}`);
  const sourceDump = join(workdir, 'source.dump');
  const safetyDump = join(workdir, 'safety.dump');
  const restoreSql = join(workdir, 'restore.sql');
  const compatibleRestoreSql = join(workdir, 'restore-compatible.sql');
  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
  const safetyObjectKey = `${target.prefix}/safety-before-restore/${timestamp}/${request.requestId}.dump`;
  const steps = [];
  const complete = (step, details = {}) => steps.push({ step, status: 'succeeded', ...details });
  const evidence = {
    version: 1,
    action: request.action,
    requestId: request.requestId,
    environment: request.environment,
    sourceObjectKey: request.sourceObjectKey,
    sourceSha256: request.sourceSha256,
    maintenanceWindowReference: request.maintenanceWindowReference,
    agentImage: required(process.env.BACKUP_AGENT_IMAGE_REF, 'BACKUP_AGENT_IMAGE_REF'),
  };
  let mutationStarted = false;
  try {
    await mkdir(workdir, { recursive: true, mode: 0o700 });
    const endpoint = required(process.env.BACKUP_S3_ENDPOINT, 'BACKUP_S3_ENDPOINT');
    const storageEnv = await s3Env(target);
    await runCommand(
      'aws',
      [
        '--endpoint-url',
        endpoint,
        's3',
        'cp',
        `s3://${target.bucket}/${request.sourceObjectKey}`,
        sourceDump,
        '--only-show-errors',
      ],
      { env: storageEnv, timeoutMs: 5 * 60_000 }
    );
    if ((await sha256(sourceDump)) !== request.sourceSha256) throw new Error('checksum_mismatch');
    complete('source-object-and-checksum-verify');
    await verifyArchiveSchema(sourceDump);
    const sourceGooseVersion = await readArchiveGooseVersion(sourceDump);
    if (!Number.isSafeInteger(sourceGooseVersion)) throw new Error('archive_schema_incompatible');
    complete('archive-and-schema-preflight', { sourceGooseVersion });

    const pgEnv = {
      ...process.env,
      PGCONNECT_TIMEOUT: '10',
      PGPASSWORD: await readSecret(target.restorePasswordFile),
    };
    await waitForSessionDrain(target, pgEnv);
    complete('app-session-drain');
    complete('exclusive-agent-restore-slot');
    const targetGooseVersion = Number(
      await runSqlAsSchemaOwner(
        target,
        pgEnv,
        'SELECT max(version_id) FROM public.goose_db_version WHERE is_applied'
      )
    );
    if (!isHistoricalSchemaRestoreCompatible(sourceGooseVersion, targetGooseVersion))
      throw new Error('schema_version_mismatch');
    complete('schema-version-compatibility', { sourceGooseVersion, targetGooseVersion });

    await runCommand(
      'pg_dump',
      [
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '--role',
        target.schemaOwner,
        '--host',
        target.postgresHost,
        '--port',
        '5432',
        '--username',
        target.restoreUser,
        '--file',
        safetyDump,
        target.postgresDatabase,
      ],
      { env: pgEnv, timeoutMs: 10 * 60_000 }
    );
    await runCommand('pg_restore', ['--list', safetyDump], { timeoutMs: 60_000 });
    const safetySha256 = await sha256(safetyDump);
    await runCommand(
      'aws',
      [
        '--endpoint-url',
        endpoint,
        's3',
        'cp',
        safetyDump,
        `s3://${target.bucket}/${safetyObjectKey}`,
        '--only-show-errors',
      ],
      { env: storageEnv, timeoutMs: 5 * 60_000 }
    );
    const safetyDownloaded = join(workdir, 'safety.download');
    await runCommand(
      'aws',
      [
        '--endpoint-url',
        endpoint,
        's3',
        'cp',
        `s3://${target.bucket}/${safetyObjectKey}`,
        safetyDownloaded,
        '--only-show-errors',
      ],
      { env: storageEnv, timeoutMs: 5 * 60_000 }
    );
    if (safetySha256 !== (await sha256(safetyDownloaded))) throw new Error('checksum_mismatch');
    await uploadJson(target, keys.safetyBackup, {
      ...evidence,
      objectKey: safetyObjectKey,
      sha256: safetySha256,
      status: 'verified',
      completedAt: new Date().toISOString(),
    });
    complete('safety-backup', { objectKey: safetyObjectKey, sha256: safetySha256 });

    mutationStarted = true;
    await runSql(target, pgEnv, restoreSchemaResetSql(target.schemaOwner));
    complete('application-schema-reset');
    await runCommand(
      'pg_restore',
      [
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        '--role',
        target.schemaOwner,
        '--file',
        restoreSql,
        sourceDump,
      ],
      { env: pgEnv, timeoutMs: 20 * 60_000 }
    );
    await writeCompatibleRestoreSql(restoreSql, compatibleRestoreSql);
    await runCommand(
      'psql',
      [
        ...postgresArgs(target),
        '--no-psqlrc',
        '--set',
        'ON_ERROR_STOP=1',
        '--file',
        compatibleRestoreSql,
      ],
      { env: pgEnv, timeoutMs: 20 * 60_000 }
    );
    complete('pg_restore');
    const principalProbe = await reconcileAndProbeRuntimePrincipal(target, pgEnv);
    complete('runtime-principal-reconciliation', { principal: target.runtimeUser });
    complete('runtime-principal-probe', { principal: target.runtimeUser, ...principalProbe });
    const gooseVersion = await runSqlAsSchemaOwner(
      target,
      pgEnv,
      'SELECT max(version_id) FROM public.goose_db_version WHERE is_applied'
    );
    const iamSchema = await runSqlAsSchemaOwner(
      target,
      pgEnv,
      `SELECT to_regclass('iam.instances') IS NOT NULL`
    );
    const appPrincipal = principalProbe.instancesSelect ? '1' : '0';
    const registryEntries = await runSqlAsSchemaOwner(
      target,
      pgEnv,
      'SELECT count(*) FROM iam.instances'
    );
    validateDatabasePostchecks({ appPrincipal, gooseVersion, iamSchema, registryEntries });
    complete('database-postchecks', { gooseVersion, registryEntries: Number(registryEntries) });
    await uploadJson(target, keys.result, {
      ...evidence,
      status: 'database-restored',
      mutationStarted,
      safetyObjectKey,
      steps,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    await uploadJson(target, keys.result, {
      ...evidence,
      status: 'failed',
      mutationStarted,
      errorCode: safeErrorCode(error),
      steps,
      completedAt: new Date().toISOString(),
    });
  } finally {
    terminalRequests.add(request.requestId);
    active = false;
    await rm(workdir, { recursive: true, force: true });
  }
};

const readBody = async (incoming) => {
  const chunks = [];
  let length = 0;
  for await (const chunk of incoming) {
    length += chunk.length;
    if (length > maxBodyBytes) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const respond = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(body)}\n`);
};

export const createBackupAgentServer = () =>
  createServer(async (incoming, response) => {
    if (incoming.method === 'GET' && incoming.url === '/health/live')
      return respond(response, 200, { status: 'ok' });
    const isBackup = incoming.url === requestPath;
    const isRestore = incoming.url === restoreRequestPath;
    if (incoming.method !== 'POST' || (!isBackup && !isRestore))
      return respond(response, 404, { error: 'not_found' });
    try {
      const request = await readBody(incoming);
      if (isBackup ? !validRequest(request) : !validRestoreRequest(request))
        return respond(response, 400, { error: 'invalid_request' });
      if (!validRequestHost(request.environment, incoming.headers.host))
        return respond(response, 400, { error: 'invalid_request' });
      const auth = incoming.headers.authorization;
      if (typeof auth !== 'string' || !auth.startsWith('Bearer '))
        return respond(response, 401, { error: 'unauthorized' });
      await verifyOidc(auth.slice('Bearer '.length), request.environment, request.action);
      const signature =
        incoming.headers[isBackup ? 'x-backup-request-signature' : 'x-restore-request-signature'];
      if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/u.test(signature))
        return respond(response, 401, { error: 'unauthorized' });
      const keyFile = isBackup
        ? targets[request.environment].signingKeyFile
        : targets[request.environment].restoreSigningKeyFile;
      const key = await readSecret(keyFile);
      const canonical = isBackup ? canonicalRequest(request) : canonicalRestoreRequest(request);
      const actual = Buffer.from(createHmac('sha256', key).update(canonical).digest('hex'), 'hex');
      const expected = Buffer.from(signature, 'hex');
      if (!timingSafeEqual(actual, expected))
        return respond(response, 401, { error: 'unauthorized' });
      if (active) return respond(response, 409, { error: 'agent_busy' });
      if (terminalRequests.has(request.requestId))
        return respond(response, 409, { error: 'request_replayed' });
      active = true;
      const target = targets[request.environment];
      const requestKey = isBackup
        ? controlKeysFor(request.requestId).request
        : restoreControlKeysFor(request.requestId).request;
      if (await objectExists(target, requestKey)) {
        active = false;
        return respond(response, 409, { error: 'request_replayed' });
      }
      try {
        await uploadJson(target, requestKey, request);
      } catch (error) {
        active = false;
        throw error;
      }
      if (isBackup) void executeBackupForIntegration(request);
      else void executeRestoreForIntegration(request);
      return respond(response, 202, { requestId: request.requestId });
    } catch {
      return respond(response, 400, { error: 'invalid_request' });
    }
  });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const versions = await Promise.all([
    runCapture('aws', ['--version']),
    runCapture('pg_dump', ['--version']),
    runCapture('pg_restore', ['--version']),
  ]);
  process.env.BACKUP_AGENT_TOOL_VERSIONS = JSON.stringify({
    aws: versions[0],
    pgDump: versions[1],
    pgRestore: versions[2],
  });
  createBackupAgentServer().listen(Number(process.env.BACKUP_AGENT_PORT || '3080'), '0.0.0.0');
}
