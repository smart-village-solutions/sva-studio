import { createHash } from 'node:crypto';
import { validTenantInstanceId } from './request-validation.mjs';

export const operationState = { active: false, terminalRequests: new Set() };

export const routePaths = {
  request: '/_ops/backup/v1/requests',
  capability: '/_ops/backup/v1/capabilities',
  restore: '/_ops/restore/v1/requests',
};

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

export const resolveDatabaseTarget = (environment, database = 'studio', operation = 'backup') => {
  const target = targets[environment];
  if (
    !target ||
    !['ssf', 'studio'].includes(database) ||
    (operation !== 'backup' && operation !== 'restore')
  )
    throw new Error('database_target_invalid');
  if (database === 'ssf') {
    const prefix = environment === 'staging' ? 'BACKUP_STAGING' : 'BACKUP_PROD';
    return {
      ...target,
      database: 'ssf',
      prefix: `${target.prefix}/ssf`,
      postgresDatabase: process.env[`${prefix}_SSF_POSTGRES_DB`] || 'sva_studio_ssf',
      runtimeRole: 'ssf_plugin_tenant_runtime',
      runtimeUser: process.env[`${prefix}_SSF_RUNTIME_USER`] || 'sva_ssf_runtime',
    };
  }
  return { ...target, database: 'studio' };
};

export const postgresIdentifierPattern = /^[a-z][a-z0-9_]{0,62}$/u;

export const deriveWasteDatabaseName = (instanceId) => {
  if (!validTenantInstanceId(instanceId)) throw new Error('waste_inventory_target_invalid');
  const normalized =
    instanceId
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '_')
      .replace(/^_+|_+$/gu, '') || 'tenant';
  const safeSlug = /^[a-z]/u.test(normalized) ? normalized : `t_${normalized}`;
  const hash = createHash('sha256').update(instanceId).digest('hex').slice(0, 12);
  return `sva_w_${safeSlug.slice(0, 25)}_${hash}_db`;
};

export const deriveWasteInventoryTarget = (environment, inventory, operation = 'backup') => {
  const target = targets[environment];
  if (
    !target ||
    !inventory ||
    !validTenantInstanceId(inventory.instanceId) ||
    !postgresIdentifierPattern.test(inventory.databaseName) ||
    inventory.databaseName !== deriveWasteDatabaseName(inventory.instanceId) ||
    !['ready', 'disabled'].includes(inventory.status) ||
    (operation !== 'backup' && operation !== 'restore')
  ) {
    throw new Error('waste_inventory_target_invalid');
  }
  const roleBase = inventory.databaseName.slice(0, -3);
  const prefix = environment === 'staging' ? 'BACKUP_STAGING' : 'BACKUP_PROD';
  const provisionerUser =
    process.env[`${prefix}_WASTE_PROVISIONER_USER`] || 'sva_waste_provisioner';
  const provisionerPasswordFile = `${prefix}_WASTE_PROVISIONER_PASSWORD_FILE`;
  return {
    ...target,
    database: 'waste',
    tenantInstanceId: inventory.instanceId,
    inventoryStatus: inventory.status,
    prefix: `${target.prefix}/waste/${inventory.instanceId}`,
    sourceDatabase: inventory.databaseName,
    postgresDatabase:
      operation === 'restore' ? `${inventory.databaseName}_restore` : inventory.databaseName,
    postgresUser: provisionerUser,
    postgresPasswordFile: provisionerPasswordFile,
    restoreUser: provisionerUser,
    restorePasswordFile: provisionerPasswordFile,
    schemaOwner: `${roleBase}_owner`,
    runtimeRole: `${roleBase}_app`,
    runtimeUser: `${roleBase}_app`,
    publicRuntimeUser: `${roleBase}_public`,
  };
};

export const validRequestHost = (environment, host) => targets[environment]?.host === host;

export const resolveCapabilityEnvironment = (requestUrl, host) => {
  const url = new URL(requestUrl ?? '', 'http://backup-agent.internal');
  if (url.pathname !== routePaths.capability) return undefined;
  const hostEnvironment = Object.entries(targets).find(([, target]) => target.host === host)?.[0];
  const requestedEnvironment = url.searchParams.get('environment');
  if (requestedEnvironment && requestedEnvironment !== 'staging' && requestedEnvironment !== 'prod')
    return undefined;
  if (requestedEnvironment && requestedEnvironment !== hostEnvironment) return undefined;
  return requestedEnvironment ?? hostEnvironment;
};

export const readBackupAgentRevision = (env = process.env) =>
  env.BACKUP_AGENT_IMAGE_REF?.trim() || undefined;

export const controlKeysFor = (requestId) => ({
  request: `control/requests/${requestId}.json`,
  result: `control/results/${requestId}.json`,
});

export const restoreControlKeysFor = (requestId) => ({
  request: `control/restores/requests/${requestId}.json`,
  safetyBackup: `control/restores/safety-backups/${requestId}.json`,
  result: `control/restores/results/${requestId}.json`,
});
