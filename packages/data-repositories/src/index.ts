export const dataRepositoriesVersion = '0.0.1';

export type DataRepositoriesPackageRole =
  'postgres-repositories' | 'migration-adjacent-types' | 'server-data-access';

export const dataRepositoriesPackageRoles = [
  'postgres-repositories',
  'migration-adjacent-types',
  'server-data-access',
] as const satisfies readonly DataRepositoriesPackageRole[];

export {
  createIamSeedRepository,
  createPermissionCacheRevisionRepository,
  createCachedInstanceIntegrationLoader,
  createExternalInterfaceRepository,
  createInstanceIntegrationRepository,
  createInstanceRegistryRepository,
  DEFAULT_INSTANCE_INTEGRATION_CACHE_TTL_MS,
  createMediaRepository,
  createStudioJobRepository,
  externalInterfaceStatements,
  iamSeedPlan,
  iamSeedStatements,
  instanceIntegrationStatements,
  mediaStatements,
} from './public-api.js';
export { createPluginTenantLifecycleRepository } from './plugin-tenant-lifecycle/index.js';

export type {
  ExternalInterfaceRepository,
  CachedInstanceIntegrationLoader,
  IamInstanceId,
  IamSeedPlan,
  IamSeedRepository,
  InstanceIntegrationRecord,
  InstanceIntegrationRepository,
  InstanceRegistryRepository,
  PermissionCatalogReconcileResult,
  PermissionCacheRevisionRepository,
  PermissionRevisionScope,
  PermissionRevisionVector,
  IntegrationProviderKey,
  MediaAssetListFilter,
  MediaAssetRecord,
  MediaReferenceRecord,
  MediaRepository,
  MediaStorageUsageRecord,
  MediaStorageUsageClaim,
  MediaStorageQuotaCheck,
  MediaStorageQuotaRecord,
  StudioJobRepository,
  MediaUploadSessionRecord,
  MediaUsageImpact,
  MediaVariantRecord,
  PermissionKey,
  PersonaSeed,
  StudioJobListResult,
  StudioJobListResultItem,
  SqlExecutionResult,
  SqlExecutor,
  SqlPrimitive,
  SqlStatement,
} from './public-api.js';
export type {
  PluginTenantAccessState,
  PluginTenantLifecycleOperation,
  PluginTenantLifecycleRecord,
  PluginTenantLifecycleRepository,
  PluginTenantLifecycleRetryKind,
  PluginTenantReadinessStatus,
} from './plugin-tenant-lifecycle/index.js';

export type {
  ExternalInterfaceConnectionCheckRecord,
  ExternalInterfaceRecord,
  ExternalInterfaceTypeDefinition,
  InstanceAuditEvent,
  InstanceProvisioningRun,
  InstanceRegistryRecord,
} from '@sva/core';
