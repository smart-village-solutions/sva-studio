import { createSdkLogger } from '@sva/server-runtime';

import type { InstanceRegistryServiceDeps } from './service-types.js';

export const instanceRegistryServiceLogger = createSdkLogger({
  component: 'iam-instance-registry-service',
  level: 'info',
});

export const DEFAULT_TENANT_ADMIN_CLIENT_ID = 'sva-studio-realm-admin';

export const invalidateHostWithLog = (
  invalidateHost: InstanceRegistryServiceDeps['invalidateHost'],
  hostname: string,
  instanceId: string
): void => {
  invalidateHost(hostname);
  instanceRegistryServiceLogger.debug('instance_host_cache_invalidated', {
    operation: 'invalidate_host',
    instance_id: instanceId,
    hostname,
  });
};

const protectSecret = (deps: InstanceRegistryServiceDeps, value: string, aad: string): string | undefined => {
  if (!deps.protectSecret) {
    throw new Error('dependency_missing_protectSecret');
  }
  return deps.protectSecret(value, aad) ?? undefined;
};

export const encryptAuthClientSecret = (
  deps: InstanceRegistryServiceDeps,
  instanceId: string,
  secret: string | undefined
): string | undefined => {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return undefined;
  }
  return protectSecret(deps, normalizedSecret, `iam.instances.auth_client_secret:${instanceId}`);
};

export const encryptTenantAdminClientSecret = (
  deps: InstanceRegistryServiceDeps,
  instanceId: string,
  secret: string | undefined
): string | undefined => {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return undefined;
  }
  return protectSecret(deps, normalizedSecret, `iam.instances.tenant_admin_client_secret:${instanceId}`);
};

export const requireModuleIamRegistry = (deps: InstanceRegistryServiceDeps) => deps.moduleIamRegistry ?? new Map();

export const resolveAssignedModuleContracts = (
  deps: InstanceRegistryServiceDeps,
  assignedModuleIds: readonly string[]
) => {
  const registry = requireModuleIamRegistry(deps);

  return assignedModuleIds.map((moduleId) => {
    const contract = registry.get(moduleId);
    if (!contract) {
      throw new Error(`unknown_module_contract:${moduleId}`);
    }
    return contract;
  });
};

export const invalidateInstancePermissionSnapshots = async (
  deps: InstanceRegistryServiceDeps,
  instanceId: string,
  trigger: string
): Promise<void> => {
  await deps.invalidatePermissionSnapshots?.({ instanceId, trigger });
};
