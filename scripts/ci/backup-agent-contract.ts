import { createHmac, timingSafeEqual } from 'node:crypto';

export type BackupEnvironment = 'staging' | 'prod';

export type BackupRequest = Readonly<{
  version: 1;
  action: 'backup-and-verify';
  requestId: string;
  environment: BackupEnvironment;
  deployImageDigest: string;
  expiresAt: string;
  maintenanceWindowReference?: string;
}>;

const environments = {
  staging: {
    bucket: 'studio-db-backup-staging',
    endpoint: 'https://studio-staging.smart-village.app/_ops/backup/v1/requests',
    objectPrefix: 'staging',
  },
  prod: {
    bucket: 'studio-db-backup-production',
    endpoint: 'https://studio.smart-village.app/_ops/backup/v1/requests',
    objectPrefix: 'prod',
  },
} as const;

export const backupEnvironmentConfig = (environment: BackupEnvironment) => environments[environment];

export const canonicalBackupRequest = (request: BackupRequest) => JSON.stringify({
  action: request.action,
  deployImageDigest: request.deployImageDigest,
  environment: request.environment,
  expiresAt: request.expiresAt,
  maintenanceWindowReference: request.maintenanceWindowReference ?? null,
  requestId: request.requestId,
  version: request.version,
});

export const signBackupRequest = (request: BackupRequest, key: string) =>
  createHmac('sha256', key).update(canonicalBackupRequest(request)).digest('hex');

export const isValidBackupRequest = (value: unknown, now = new Date()) : value is BackupRequest => {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<BackupRequest>;
  const allowedKeys = new Set(['action', 'deployImageDigest', 'environment', 'expiresAt', 'maintenanceWindowReference', 'requestId', 'version']);
  if (Object.keys(request).some((key) => !allowedKeys.has(key))) return false;
  if (request.version !== 1 || request.action !== 'backup-and-verify') return false;
  if (request.environment !== 'staging' && request.environment !== 'prod') return false;
  if (typeof request.requestId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,127}$/u.test(request.requestId)) return false;
  if (typeof request.deployImageDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(request.deployImageDigest)) return false;
  if (
    typeof request.expiresAt !== 'string'
    || Number.isNaN(Date.parse(request.expiresAt))
    || Date.parse(request.expiresAt) <= now.getTime()
    || Date.parse(request.expiresAt) > now.getTime() + 10 * 60_000
  ) return false;
  return request.environment !== 'prod'
    || (typeof request.maintenanceWindowReference === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/# -]{2,159}$/u.test(request.maintenanceWindowReference));
};

export const verifyBackupRequestSignature = (request: BackupRequest, key: string, signature: string) => {
  const actual = Buffer.from(signBackupRequest(request, key), 'hex');
  const expected = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
