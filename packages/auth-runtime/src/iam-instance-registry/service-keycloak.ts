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
} from '@sva/instance-registry/service-keycloak';
import type { InstanceRegistryServiceDeps } from '@sva/instance-registry/service-types';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

import { withAuthInstanceRegistryDeps } from './instance-registry-deps.js';

export { createGetKeycloakProvisioningRunHandler, createRuntimeResolver };

const authSecretDeps = () => withAuthInstanceRegistryDeps({});
const bindRegistryServiceDeps = <T>(factory: (deps: InstanceRegistryServiceDeps) => T) => (deps: InstanceRegistryServiceDeps): T =>
  factory(withAuthInstanceRegistryDeps(deps));

const decryptSecret = (
  decryptor: typeof decryptTargetAuthClientSecret,
  instanceId: string,
  ciphertext: string | null | undefined
): string | undefined => decryptor(authSecretDeps(), instanceId, ciphertext);

const loadRepositorySecret = async (
  loader: typeof loadTargetRepositoryAuthClientSecret,
  repository: InstanceRegistryRepository,
  instanceId: string
): Promise<string | undefined> => loader(authSecretDeps(), repository, instanceId);

export const decryptAuthClientSecret = (
  instanceId: string,
  ciphertext: string | null | undefined
): string | undefined => decryptSecret(decryptTargetAuthClientSecret, instanceId, ciphertext);

export const decryptTenantAdminClientSecret = (
  instanceId: string,
  ciphertext: string | null | undefined
): string | undefined => decryptSecret(decryptTargetTenantAdminClientSecret, instanceId, ciphertext);

export const loadRepositoryAuthClientSecret = async (
  repository: InstanceRegistryRepository,
  instanceId: string
): Promise<string | undefined> => loadRepositorySecret(loadTargetRepositoryAuthClientSecret, repository, instanceId);

export const loadRepositoryTenantAdminClientSecret = async (
  repository: InstanceRegistryRepository,
  instanceId: string
): Promise<string | undefined> =>
  loadRepositorySecret(loadTargetRepositoryTenantAdminClientSecret, repository, instanceId);

export const loadInstanceWithSecret = (deps: InstanceRegistryServiceDeps, instanceId: string) =>
  loadTargetInstanceWithSecret(withAuthInstanceRegistryDeps(deps), instanceId);

export const createGetKeycloakStatusHandler = bindRegistryServiceDeps(createTargetGetKeycloakStatusHandler);
export const createGetKeycloakPreflightHandler = bindRegistryServiceDeps(createTargetGetKeycloakPreflightHandler);
export const createPlanKeycloakProvisioningHandler = bindRegistryServiceDeps(createTargetPlanKeycloakProvisioningHandler);
export const createExecuteKeycloakProvisioningHandler = bindRegistryServiceDeps(
  createTargetExecuteKeycloakProvisioningHandler
);
export const createReconcileKeycloakHandler = bindRegistryServiceDeps(createTargetReconcileKeycloakHandler);
