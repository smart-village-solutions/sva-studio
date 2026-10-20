import { targets } from './runtime-config.mjs';
import { required } from './runtime-io.mjs';
import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { validateBackupRequest, validateRestoreRequest } from './request-validation.mjs';

const oidcIssuer = 'https://token.actions.githubusercontent.com';

const jwksUrl = `${oidcIssuer}/.well-known/jwks`;

export const bbPrignitzWasteImportSha256 =
  'df75392bee510be71444eec28914f704c0917a5a59ac46e6380ef050c3ffd5dc';

export const bbPrignitzWasteImportObjectKey =
  'prod/waste/bb-prignitz/import/2026-08-09/waste-data-pg16.sql';

export const canonicalRequest = (request) =>
  JSON.stringify({
    action: request.action,
    deployImageDigest: request.deployImageDigest,
    environment: request.environment,
    expiresAt: request.expiresAt,
    ...(request.database ? { database: request.database } : {}),
    ...(request.tenantInstanceId ? { tenantInstanceId: request.tenantInstanceId } : {}),
    ...(request.version === 1
      ? { maintenanceWindowReference: request.maintenanceWindowReference ?? null }
      : {}),
    requestId: request.requestId,
    version: request.version,
  });

export const canonicalRestoreRequest = (request) =>
  JSON.stringify({
    action: request.action,
    ...(request.database ? { database: request.database } : {}),
    ...(request.tenantInstanceId ? { tenantInstanceId: request.tenantInstanceId } : {}),
    environment: request.environment,
    expiresAt: request.expiresAt,
    maintenanceWindowReference: request.maintenanceWindowReference,
    requestId: request.requestId,
    sourceObjectKey: request.sourceObjectKey,
    sourceSha256: request.sourceSha256,
    version: request.version,
  });

export const validRequest = (request, now = Date.now()) => validateBackupRequest(request, now).ok;

const restoreValidationContract = Object.freeze({
  environmentPrefixes: Object.freeze({
    staging: targets.staging.prefix,
    prod: targets.prod.prefix,
  }),
  wasteImport: Object.freeze({
    objectKey: bbPrignitzWasteImportObjectKey,
    sha256: bbPrignitzWasteImportSha256,
    environment: 'prod',
    database: 'waste',
    tenantInstanceId: 'bb-prignitz',
  }),
});

export const validRestoreRequest = (request, now = Date.now()) =>
  validateRestoreRequest(request, restoreValidationContract, now).ok;

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
    action === 'restore-and-verify-v1' || action === 'import-waste-data-v1'
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

export const verifyOidc = async (token, environment, action) => {
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
