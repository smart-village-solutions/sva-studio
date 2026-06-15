import type { SqlExecutor } from '../iam/repositories/types.js';

import { createKeycloakProvisioningRepository } from './repository-keycloak-provisioning.js';
import type {
  CreateKeycloakProvisioningRunResult,
  InstanceModuleIamContractRecord,
  InstanceRegistryRepository,
  ProtectedSystemRolePermissionBundleRecord,
} from './repository-contract.js';
import { createModuleIamRepository } from './repository-module-iam.js';
import { createMutationRepository } from './repository-mutations.js';
import { createProvisioningRepository } from './repository-provisioning.js';
import { createReadRepository } from './repository-reads.js';

export type {
  CreateKeycloakProvisioningRunResult,
  InstanceModuleIamContractRecord,
  InstanceRegistryRepository,
  ProtectedSystemRolePermissionBundleRecord,
};

export const createInstanceRegistryRepository = (executor: SqlExecutor): InstanceRegistryRepository => ({
  ...createReadRepository(executor),
  ...createModuleIamRepository(executor),
  ...createProvisioningRepository(executor),
  ...createMutationRepository(executor),
  ...createKeycloakProvisioningRepository(executor),
});
