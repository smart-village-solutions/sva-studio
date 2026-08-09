import type { SqlExecutor } from '../iam/repositories/types.js';

import { createConfirmationChallengeRepository } from './repository-confirmation-challenges.js';
import { createKeycloakProvisioningRepository } from './repository-keycloak-provisioning.js';
import type {
  CreateKeycloakProvisioningRunResult,
  ConsumeInstanceConfirmationChallengeInput,
  InstanceConfirmationChallengeRecord,
  InstanceModuleIamContractRecord,
  InstanceRegistryRepository,
  PermissionCatalogReconcileResult,
  ProtectedSystemRolePermissionBundleRecord,
  PrepareInstanceConfirmationChallengeInput,
} from './repository-contract.js';
import { createModuleIamRepository } from './repository-module-iam.js';
import { createMutationRepository } from './repository-mutations.js';
import { createProvisioningRepository } from './repository-provisioning.js';
import { createReadRepository } from './repository-reads.js';
import { createWasteProvisioningRepository } from './repository-waste-provisioning.js';
import { createPermissionCacheRevisionRepository } from '../iam/permission-cache-revisions.js';

export type {
  CreateKeycloakProvisioningRunResult,
  ConsumeInstanceConfirmationChallengeInput,
  InstanceConfirmationChallengeRecord,
  InstanceModuleIamContractRecord,
  InstanceRegistryRepository,
  PermissionCatalogReconcileResult,
  ProtectedSystemRolePermissionBundleRecord,
  PrepareInstanceConfirmationChallengeInput,
};

export const createInstanceRegistryRepository = (executor: SqlExecutor): InstanceRegistryRepository => {
  const permissionCacheRevisions = createPermissionCacheRevisionRepository(executor);
  return {
    ...createConfirmationChallengeRepository(executor),
    ...createReadRepository(executor),
    ...createModuleIamRepository(executor),
    ...createProvisioningRepository(executor),
    ...createMutationRepository(executor),
    ...createKeycloakProvisioningRepository(executor),
    ...createWasteProvisioningRepository(executor),
    bumpPermissionCacheInstanceRevision: (instanceId) =>
      permissionCacheRevisions.bump({ kind: 'instance', instanceId }),
  };
};
