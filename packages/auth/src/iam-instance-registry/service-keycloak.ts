import {
  createExecuteKeycloakProvisioningHandler as createTargetExecuteKeycloakProvisioningHandler,
  createGetKeycloakPreflightHandler as createTargetGetKeycloakPreflightHandler,
  createGetKeycloakProvisioningRunHandler,
  createGetKeycloakStatusHandler as createTargetGetKeycloakStatusHandler,
  createPlanKeycloakProvisioningHandler as createTargetPlanKeycloakProvisioningHandler,
  createReconcileKeycloakHandler as createTargetReconcileKeycloakHandler,
  createRuntimeResolver,
  decryptAuthClientSecret as decryptTargetAuthClientSecret,
  decryptTenantAdminClientSecret as decryptTargetTenantAdminClientSecret,
  loadInstanceWithSecret as loadTargetInstanceWithSecret,
  loadRepositoryAuthClientSecret as loadTargetRepositoryAuthClientSecret,
  loadRepositoryTenantAdminClientSecret as loadTargetRepositoryTenantAdminClientSecret,
  type InstanceRegistryServiceDeps,
} from '@sva/instance-registry';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

import { withAuthInstanceRegistryDeps } from './instance-registry-deps.js';

export { createGetKeycloakProvisioningRunHandler, createRuntimeResolver };

const authSecretDeps = () => withAuthInstanceRegistryDeps({}) as InstanceRegistryServiceDeps;

export const decryptAuthClientSecret = (
  instanceId: string,
  ciphertext: string | null | undefined
): string | undefined => decryptTargetAuthClientSecret(authSecretDeps(), instanceId, ciphertext);

export const decryptTenantAdminClientSecret = (
  instanceId: string,
  ciphertext: string | null | undefined
): string | undefined => decryptTargetTenantAdminClientSecret(authSecretDeps(), instanceId, ciphertext);

export const loadRepositoryAuthClientSecret = async (
  repository: InstanceRegistryRepository,
  instanceId: string
): Promise<string | undefined> =>
  loadTargetRepositoryAuthClientSecret(authSecretDeps(), repository, instanceId);

export const loadRepositoryTenantAdminClientSecret = async (
  repository: InstanceRegistryRepository,
  instanceId: string
): Promise<string | undefined> =>
  loadTargetRepositoryTenantAdminClientSecret(authSecretDeps(), repository, instanceId);

export const loadInstanceWithSecret = (deps: InstanceRegistryServiceDeps, instanceId: string) =>
  loadTargetInstanceWithSecret(withAuthInstanceRegistryDeps(deps), instanceId);

export const createGetKeycloakStatusHandler = (deps: InstanceRegistryServiceDeps) =>
  createTargetGetKeycloakStatusHandler(withAuthInstanceRegistryDeps(deps));

export const createGetKeycloakPreflightHandler = (deps: InstanceRegistryServiceDeps) =>
  createTargetGetKeycloakPreflightHandler(withAuthInstanceRegistryDeps(deps));

export const createPlanKeycloakProvisioningHandler = (deps: InstanceRegistryServiceDeps) =>
  createTargetPlanKeycloakProvisioningHandler(withAuthInstanceRegistryDeps(deps));

export const createExecuteKeycloakProvisioningHandler = (deps: InstanceRegistryServiceDeps) =>
  createTargetExecuteKeycloakProvisioningHandler(withAuthInstanceRegistryDeps(deps));

export const createReconcileKeycloakHandler = (deps: InstanceRegistryServiceDeps) =>
  createTargetReconcileKeycloakHandler(withAuthInstanceRegistryDeps(deps));
