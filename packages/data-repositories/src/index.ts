export const dataRepositoriesVersion = '0.0.1';

export type DataRepositoriesPackageRole = 'postgres-repositories' | 'migration-adjacent-types' | 'server-data-access';

export const dataRepositoriesPackageRoles = [
  'postgres-repositories',
  'migration-adjacent-types',
  'server-data-access',
] as const satisfies readonly DataRepositoriesPackageRole[];

export {
  createIamSeedRepository,
  createInstanceIntegrationRepository,
  createInstanceRegistryRepository,
  iamSeedPlan,
  iamSeedStatements,
  instanceIntegrationStatements,
} from '@sva/data';

export type {
  CachedInstanceIntegrationLoader,
  IamInstanceId,
  IamSeedPlan,
  IamSeedRepository,
  InstanceIntegrationRecord,
  InstanceIntegrationRepository,
  InstanceRegistryRepository,
  IntegrationProviderKey,
  PermissionKey,
  PersonaSeed,
  SqlExecutionResult,
  SqlExecutor,
  SqlPrimitive,
  SqlStatement,
} from '@sva/data';

export type { InstanceAuditEvent, InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/core';
