import { createHash, createHmac, createPublicKey, randomUUID, timingSafeEqual, verify as verifySignature } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const requestPath = '/_ops/backup/v1/requests';
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

const readSecret = async (name) => (await readFile(required(process.env[name], name), 'utf8')).trim();

const targets = {
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
  },
  prod: {
    host: 'backup-studio.smart-village.app',
    bucket: 'studio-db-backup-production',
    prefix: 'prod',
    postgresHost: 'studio-prod_postgres',
    postgresDatabase: process.env.BACKUP_PROD_POSTGRES_DB || 'sva_studio',
    postgresUser: process.env.BACKUP_PROD_POSTGRES_USER || 'sva',
    postgresPasswordFile: 'BACKUP_PROD_POSTGRES_PASSWORD_FILE',
    s3AccessKeyFile: 'BACKUP_PROD_S3_ACCESS_KEY_FILE',
    s3SecretKeyFile: 'BACKUP_PROD_S3_SECRET_KEY_FILE',
    signingKeyFile: 'BACKUP_PROD_SIGNING_KEY_FILE',
  },
};

export const validRequestHost = (environment, host) => targets[environment]?.host === host;

export const canonicalRequest = (request) => JSON.stringify({
  action: request.action,
  deployImageDigest: request.deployImageDigest,
  environment: request.environment,
  expiresAt: request.expiresAt,
  maintenanceWindowReference: request.maintenanceWindowReference ?? null,
  requestId: request.requestId,
  version: request.version,
});

export const validRequest = (request, now = Date.now()) => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return false;
  const allowedKeys = new Set(['action', 'deployImageDigest', 'environment', 'expiresAt', 'maintenanceWindowReference', 'requestId', 'version']);
  if (Object.keys(request).some((key) => !allowedKeys.has(key))) return false;
  if (request.version !== 1 || request.action !== 'backup-and-verify') return false;
  if (request.environment !== 'staging' && request.environment !== 'prod') return false;
  if (typeof request.requestId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,127}$/u.test(request.requestId)) return false;
  if (typeof request.deployImageDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(request.deployImageDigest)) return false;
  const expiresAt = typeof request.expiresAt === 'string' ? Date.parse(request.expiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + maxRequestLifetimeMs) return false;
  return request.environment !== 'prod'
    || (typeof request.maintenanceWindowReference === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/# -]{2,159}$/u.test(request.maintenanceWindowReference));
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

export const validateOidcClaims = (claims, environment, now = Math.floor(Date.now() / 1_000)) => {
  if (claims.iss !== oidcIssuer || claims.aud !== required(process.env.BACKUP_AGENT_OIDC_AUDIENCE, 'BACKUP_AGENT_OIDC_AUDIENCE')) throw new Error('oidc_claims_invalid');
  if (typeof claims.exp !== 'number' || typeof claims.nbf !== 'number' || claims.exp <= now || claims.nbf > now) throw new Error('oidc_time_invalid');
  if (claims.repository !== required(process.env.BACKUP_AGENT_GITHUB_REPOSITORY, 'BACKUP_AGENT_GITHUB_REPOSITORY')) throw new Error('oidc_repository_invalid');
  if (claims.environment !== environment) throw new Error('oidc_environment_invalid');
  const allowedWorkflows = required(process.env.BACKUP_AGENT_ALLOWED_WORKFLOWS, 'BACKUP_AGENT_ALLOWED_WORKFLOWS')
    .split(',')
    .map((value) => `${claims.repository}/.github/workflows/${value.trim()}@refs/heads/main`);
  const workflowReferences = [claims.workflow_ref, claims.job_workflow_ref].filter((value) => typeof value === 'string');
  if (!workflowReferences.some((value) => allowedWorkflows.includes(value))) throw new Error('oidc_workflow_invalid');
};

const verifyOidc = async (token, environment) => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('oidc_token_invalid');
  const header = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'));
  const claims = JSON.parse(decodeBase64Url(parts[1]).toString('utf8'));
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('oidc_header_invalid');
  const key = (await getJwks()).find((candidate) => candidate.kid === header.kid);
  if (!key) throw new Error('oidc_key_unknown');
  const valid = verifySignature(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey({ key, format: 'jwk' }),
    decodeBase64Url(parts[2]),
  );
  if (!valid) throw new Error('oidc_signature_invalid');
  validateOidcClaims(claims, environment);
};

export const runCommand = (command, args, options = {}) => new Promise((resolve, reject) => {
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
  child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-2_000); });
  child.once('error', (error) => finish(() => reject(error)));
  child.once('exit', (code) => finish(() => code === 0 ? resolve() : reject(new Error(`${command}_failed_${String(code)}:${stderr.replaceAll(/\s+/gu, ' ')}`))));
});

const runCapture = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-1_000); });
  child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-1_000); });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolve(stdout.trim() || stderr.trim()) : reject(new Error(`${command}_preflight_failed_${String(code)}`)));
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
    await runCommand('aws', ['--endpoint-url', required(process.env.BACKUP_S3_ENDPOINT, 'BACKUP_S3_ENDPOINT'), 's3', 'cp', path, `s3://${target.bucket}/${key}`, '--only-show-errors'], { env: await s3Env(target), timeoutMs: acceptanceCommandTimeoutMs });
  } finally {
    await runCommand('rm', ['-f', path]);
  }
};

const objectExists = async (target, key) => {
  try {
    await runCommand('aws', ['--endpoint-url', required(process.env.BACKUP_S3_ENDPOINT, 'BACKUP_S3_ENDPOINT'), 's3api', 'head-object', '--bucket', target.bucket, '--key', key], { env: await s3Env(target), timeoutMs: acceptanceCommandTimeoutMs });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('aws_failed_254:')) return false;
    throw error;
  }
};

const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');

export const safeErrorCode = (error) => {
  const message = error instanceof Error ? error.message : '';
  if (message === 'checksum_mismatch') return message;
  const commandFailure = /^(aws|pg_dump|pg_restore)_failed_[0-9]+/u.exec(message);
  return commandFailure?.[0] ?? 'backup_failed';
};

let active = false;
const terminalRequests = new Set();

export const controlKeysFor = (requestId) => ({
  request: `control/requests/${requestId}.json`,
  result: `control/results/${requestId}.json`,
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
    tools: JSON.parse(required(process.env.BACKUP_AGENT_TOOL_VERSIONS, 'BACKUP_AGENT_TOOL_VERSIONS')),
  };
  try {
    await runCommand('mkdir', ['-p', workdir]);
    const pgEnv = { ...process.env, PGPASSWORD: await readSecret(target.postgresPasswordFile) };
    await runCommand('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--host', target.postgresHost, '--port', '5432', '--username', target.postgresUser, '--file', dump, target.postgresDatabase], { env: pgEnv });
    complete('pg_dump');
    const env = await s3Env(target);
    const endpoint = required(process.env.BACKUP_S3_ENDPOINT, 'BACKUP_S3_ENDPOINT');
    await runCommand('aws', ['--endpoint-url', endpoint, 's3', 'cp', dump, `s3://${target.bucket}/${objectKey}`, '--only-show-errors'], { env });
    complete('upload');
    await runCommand('aws', ['--endpoint-url', endpoint, 's3', 'cp', `s3://${target.bucket}/${objectKey}`, downloaded, '--only-show-errors'], { env });
    complete('download');
    const dumpDigest = await sha256(dump);
    if (dumpDigest !== await sha256(downloaded)) throw new Error('checksum_mismatch');
    const bytes = (await readFile(dump)).byteLength;
    complete('size-and-checksum-verify', { bytes, sha256: dumpDigest });
    await writeFile(`${dump}.sha256`, `${dumpDigest}  backup.dump\n`, { mode: 0o600 });
    await runCommand('aws', ['--endpoint-url', endpoint, 's3', 'cp', `${dump}.sha256`, `s3://${target.bucket}/${objectKey}.sha256`, '--only-show-errors'], { env });
    await runCommand('pg_restore', ['--list', downloaded]);
    complete('archive-validate');
    await uploadJson(target, resultKey, { ...evidence, status: 'succeeded', objectKey, bytes, sha256: dumpDigest, steps, completedAt: new Date().toISOString() });
  } catch (error) {
    await uploadJson(target, resultKey, { ...evidence, status: 'failed', errorCode: safeErrorCode(error), steps, completedAt: new Date().toISOString() });
  } finally {
    terminalRequests.add(request.requestId);
    active = false;
    await runCommand('rm', ['-rf', workdir]);
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

export const createBackupAgentServer = () => createServer(async (incoming, response) => {
  if (incoming.method === 'GET' && incoming.url === '/health/live') return respond(response, 200, { status: 'ok' });
  if (incoming.method !== 'POST' || incoming.url !== requestPath) return respond(response, 404, { error: 'not_found' });
  try {
    const request = await readBody(incoming);
    if (!validRequest(request)) return respond(response, 400, { error: 'invalid_request' });
    if (!validRequestHost(request.environment, incoming.headers.host)) return respond(response, 400, { error: 'invalid_request' });
    const auth = incoming.headers.authorization;
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return respond(response, 401, { error: 'unauthorized' });
    await verifyOidc(auth.slice('Bearer '.length), request.environment);
    const signature = incoming.headers['x-backup-request-signature'];
    if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/u.test(signature)) return respond(response, 401, { error: 'unauthorized' });
    const key = await readSecret(targets[request.environment].signingKeyFile);
    const actual = Buffer.from(createHmac('sha256', key).update(canonicalRequest(request)).digest('hex'), 'hex');
    const expected = Buffer.from(signature, 'hex');
    if (!timingSafeEqual(actual, expected)) return respond(response, 401, { error: 'unauthorized' });
    if (active) return respond(response, 409, { error: 'agent_busy' });
    if (terminalRequests.has(request.requestId)) return respond(response, 409, { error: 'request_replayed' });
    active = true;
    const target = targets[request.environment];
    const requestKey = controlKeysFor(request.requestId).request;
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
    void executeBackupForIntegration(request);
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
  process.env.BACKUP_AGENT_TOOL_VERSIONS = JSON.stringify({ aws: versions[0], pgDump: versions[1], pgRestore: versions[2] });
  createBackupAgentServer().listen(Number(process.env.BACKUP_AGENT_PORT || '3080'), '0.0.0.0');
}
