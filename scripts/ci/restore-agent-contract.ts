import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  backupEnvironmentConfig,
  type BackupDatabase,
  type BackupEnvironment,
} from './backup-agent-contract.ts';

export type RestoreRequest = Readonly<{
  version: 1;
  action: 'restore-and-verify-v1' | 'import-waste-data-v1';
  requestId: string;
  environment: BackupEnvironment;
  expiresAt: string;
  maintenanceWindowReference: string;
  sourceObjectKey: string;
  sourceSha256: string;
  database?: BackupDatabase;
  tenantInstanceId?: string;
}>;

const requestIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{7,127}$/u;
const maintenanceWindowPattern = /^[A-Za-z0-9][A-Za-z0-9._:/# -]{2,159}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const bbPrignitzWasteImportSha256 =
  'df75392bee510be71444eec28914f704c0917a5a59ac46e6380ef050c3ffd5dc';
const bbPrignitzWasteImportObjectKey =
  'prod/waste/bb-prignitz/import/2026-08-09/waste-data-pg16.sql';
const restoreRequestKeys = new Set([
  'action',
  'database',
  'environment',
  'expiresAt',
  'maintenanceWindowReference',
  'requestId',
  'sourceObjectKey',
  'sourceSha256',
  'tenantInstanceId',
  'version',
]);

export const restoreEnvironmentConfig = (environment: BackupEnvironment) => ({
  ...backupEnvironmentConfig(environment),
  endpoint: backupEnvironmentConfig(environment).endpoint.replace(
    '/_ops/backup/v1/requests',
    '/_ops/restore/v1/requests'
  ),
});

export const canonicalRestoreRequest = (request: RestoreRequest) =>
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

export const signRestoreRequest = (request: RestoreRequest, key: string) =>
  createHmac('sha256', key).update(canonicalRestoreRequest(request)).digest('hex');

const hasOnlyRestoreRequestKeys = (request: object) =>
  Object.keys(request).every((key) => restoreRequestKeys.has(key));

const hasValidSourceObject = (
  environment: BackupEnvironment,
  action: RestoreRequest['action'],
  database: BackupDatabase | undefined,
  tenantInstanceId: string | undefined,
  sourceObjectKey: unknown,
  sourceSha256: unknown
) => {
  const isWasteImport = action === 'import-waste-data-v1';
  const databasePrefix =
    database === 'waste' ? `/waste/${tenantInstanceId}/${isWasteImport ? 'import/' : ''}` : '/';
  const prefix = `${restoreEnvironmentConfig(environment).objectPrefix}${databasePrefix}`;
  return (
    typeof sourceObjectKey === 'string' &&
    sourceObjectKey.startsWith(prefix) &&
    (isWasteImport
      ? /^[A-Za-z0-9][A-Za-z0-9._/-]{7,511}\.sql$/u.test(sourceObjectKey)
      : /^[A-Za-z0-9][A-Za-z0-9._/-]{7,511}\.dump$/u.test(sourceObjectKey)) &&
    !sourceObjectKey.includes('..') &&
    typeof sourceSha256 === 'string' &&
    sha256Pattern.test(sourceSha256)
  );
};

const hasValidExpiry = (expiresAt: unknown, now: Date) => {
  const timestamp = typeof expiresAt === 'string' ? Date.parse(expiresAt) : Number.NaN;
  return (
    Number.isFinite(timestamp) &&
    timestamp > now.getTime() &&
    timestamp <= now.getTime() + 10 * 60_000
  );
};

type RestoreRequestEnvelope = Partial<RestoreRequest> &
  Readonly<{
    action: RestoreRequest['action'];
    environment: BackupEnvironment;
  }>;

const hasValidEnvelope = (request: Partial<RestoreRequest>): request is RestoreRequestEnvelope =>
  request.version === 1 &&
  (request.action === 'restore-and-verify-v1' || request.action === 'import-waste-data-v1') &&
  (request.environment === 'staging' || request.environment === 'prod') &&
  (request.database === undefined || request.database === 'studio' || request.database === 'waste');

const hasValidTenantBinding = (request: RestoreRequestEnvelope): boolean =>
  request.database === 'waste'
    ? typeof request.tenantInstanceId === 'string' &&
      /^[a-z0-9][a-z0-9-]{1,62}$/u.test(request.tenantInstanceId)
    : request.tenantInstanceId === undefined;

const hasValidImportBinding = (request: RestoreRequestEnvelope): boolean =>
  request.action !== 'import-waste-data-v1' ||
  (request.environment === 'prod' &&
    request.database === 'waste' &&
    request.tenantInstanceId === 'bb-prignitz' &&
    request.sourceObjectKey === bbPrignitzWasteImportObjectKey &&
    request.sourceSha256 === bbPrignitzWasteImportSha256);

const hasValidRequestMetadata = (request: RestoreRequestEnvelope): boolean =>
  typeof request.requestId === 'string' &&
  requestIdPattern.test(request.requestId) &&
  typeof request.maintenanceWindowReference === 'string' &&
  maintenanceWindowPattern.test(request.maintenanceWindowReference);

export const isValidRestoreRequest = (
  value: unknown,
  now = new Date()
): value is RestoreRequest => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as Partial<RestoreRequest>;
  if (!hasOnlyRestoreRequestKeys(request) || !hasValidEnvelope(request)) return false;
  return (
    hasValidTenantBinding(request) &&
    hasValidImportBinding(request) &&
    hasValidRequestMetadata(request) &&
    hasValidSourceObject(
      request.environment,
      request.action,
      request.database,
      request.tenantInstanceId,
      request.sourceObjectKey,
      request.sourceSha256
    ) &&
    hasValidExpiry(request.expiresAt, now)
  );
};

export const verifyRestoreRequestSignature = (
  request: RestoreRequest,
  key: string,
  signature: string
) => {
  if (!sha256Pattern.test(signature)) return false;
  const actual = Buffer.from(signRestoreRequest(request, key), 'hex');
  const expected = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
