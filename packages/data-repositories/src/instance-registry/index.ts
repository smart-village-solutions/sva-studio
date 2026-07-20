import type { SqlExecutor } from '../iam/repositories/types.js';

import { createConfirmationChallengeRepository } from './repository-confirmation-challenges.js';
import { createKeycloakProvisioningRepository } from './repository-keycloak-provisioning.js';
import type {
  CreateKeycloakProvisioningRunResult,
  ConsumeInstanceConfirmationChallengeInput,
  InstanceConfirmationChallengeRecord,
  InstanceModuleIamContractRecord,
  InstanceRegistryRepository,
  ProtectedSystemRolePermissionBundleRecord,
  PrepareInstanceConfirmationChallengeInput,
} from './repository-contract.js';
import { createModuleIamRepository } from './repository-module-iam.js';
import { createMutationRepository } from './repository-mutations.js';
import { createProvisioningRepository } from './repository-provisioning.js';
import { createReadRepository } from './repository-reads.js';

export type {
  CreateKeycloakProvisioningRunResult,
  ConsumeInstanceConfirmationChallengeInput,
  InstanceConfirmationChallengeRecord,
  InstanceModuleIamContractRecord,
  InstanceRegistryRepository,
  ProtectedSystemRolePermissionBundleRecord,
  PrepareInstanceConfirmationChallengeInput,
};

export const createInstanceRegistryRepository = (executor: SqlExecutor): InstanceRegistryRepository => ({
  ...createConfirmationChallengeRepository(executor),
  ...createReadRepository(executor),
  ...createModuleIamRepository(executor),
  ...createProvisioningRepository(executor),
  ...createMutationRepository(executor),
  ...createKeycloakProvisioningRepository(executor),
});
