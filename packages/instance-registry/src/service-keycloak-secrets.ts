import type { InstanceRegistryRepository } from '@sva/data-repositories';

import type { InstanceRegistryServiceDeps } from './service-types.js';

const buildAuthClientSecretAad = (instanceId: string): string => `iam.instances.auth_client_secret:${instanceId}`;
const buildTenantAdminClientSecretAad = (instanceId: string): string =>
  `iam.instances.tenant_admin_client_secret:${instanceId}`;

type SecretReaderDeps = Pick<InstanceRegistryServiceDeps, 'revealSecret'>;

const revealSecret = (
  deps: SecretReaderDeps,
  value: string | null | undefined,
  aad: string
): string | undefined => {
  if (!deps.revealSecret) {
    throw new Error('dependency_missing_revealSecret');
  }
  return deps.revealSecret(value, aad);
};

export const decryptAuthClientSecret = (
  deps: SecretReaderDeps,
  instanceId: string,
  ciphertext: string | null | undefined
): string | undefined => revealSecret(deps, ciphertext, buildAuthClientSecretAad(instanceId));

export const decryptTenantAdminClientSecret = (
  deps: SecretReaderDeps,
  instanceId: string,
  ciphertext: string | null | undefined
): string | undefined => revealSecret(deps, ciphertext, buildTenantAdminClientSecretAad(instanceId));

export const loadRepositoryAuthClientSecret = async (
  deps: SecretReaderDeps,
  repository: InstanceRegistryRepository,
  instanceId: string
): Promise<string | undefined> => {
  const ciphertext = await repository.getAuthClientSecretCiphertext(instanceId);
  return decryptAuthClientSecret(deps, instanceId, ciphertext);
};

export const loadRepositoryTenantAdminClientSecret = async (
  deps: SecretReaderDeps,
  repository: InstanceRegistryRepository,
  instanceId: string
): Promise<string | undefined> => {
  if (typeof repository.getTenantAdminClientSecretCiphertext !== 'function') {
    return undefined;
  }
  const ciphertext = await repository.getTenantAdminClientSecretCiphertext(instanceId);
  return decryptTenantAdminClientSecret(deps, instanceId, ciphertext);
};

export const loadInstanceWithSecret = async (deps: InstanceRegistryServiceDeps, instanceId: string) => {
  const instance = await deps.repository.getInstanceById(instanceId);
  if (!instance) {
    return null;
  }
  const authClientSecret = await loadRepositoryAuthClientSecret(deps, deps.repository, instance.instanceId);
  const tenantAdminClientSecret = await loadRepositoryTenantAdminClientSecret(deps, deps.repository, instance.instanceId);
  return {
    instance,
    authClientSecret,
    tenantAdminClientSecret,
  };
};
