import { classifyHost, normalizeHost } from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data';
import type { InstanceRegistryServiceDeps, ResolveRuntimeInstanceResult } from './types.js';
import { revealField } from '../iam-account-management/encryption.js';
import { toListItem } from './service-helpers.js';

const buildAuthClientSecretAad = (instanceId: string): string => `iam.instances.auth_client_secret:${instanceId}`;

export const decryptAuthClientSecret = (
  instanceId: string,
  ciphertext: string | null | undefined
): string | undefined => revealField(ciphertext, buildAuthClientSecretAad(instanceId));

export const loadRepositoryAuthClientSecret = async (
  repository: InstanceRegistryRepository,
  instanceId: string
): Promise<string | undefined> => {
  const ciphertext = await repository.getAuthClientSecretCiphertext(instanceId);
  return decryptAuthClientSecret(instanceId, ciphertext);
};

export const createGetKeycloakStatusHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (instanceId: string) => {
    const instance = await deps.repository.getInstanceById(instanceId);
    if (!instance || !deps.getKeycloakStatus) {
      return null;
    }

    return deps.getKeycloakStatus({
      instanceId: instance.instanceId,
      primaryHostname: instance.primaryHostname,
      authRealm: instance.authRealm,
      authClientId: instance.authClientId,
      authIssuerUrl: instance.authIssuerUrl,
      authClientSecretConfigured: instance.authClientSecretConfigured,
      authClientSecret: await loadRepositoryAuthClientSecret(deps.repository, instance.instanceId),
      tenantAdminBootstrap: instance.tenantAdminBootstrap,
    });
  };

export const createReconcileKeycloakHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (input: {
    instanceId: string;
    actorId: string;
    requestId: string;
    tenantAdminTemporaryPassword?: string;
    rotateClientSecret?: boolean;
  }) => {
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance || !deps.provisionInstanceAuth || !deps.getKeycloakStatus) {
      return null;
    }

    const authClientSecret = await loadRepositoryAuthClientSecret(deps.repository, input.instanceId);
    if (!authClientSecret) {
      throw new Error('tenant_auth_client_secret_missing');
    }

    await deps.provisionInstanceAuth({
      instanceId: instance.instanceId,
      primaryHostname: instance.primaryHostname,
      authRealm: instance.authRealm,
      authClientId: instance.authClientId,
      authIssuerUrl: instance.authIssuerUrl,
      authClientSecret,
      tenantAdminBootstrap: instance.tenantAdminBootstrap,
      tenantAdminTemporaryPassword: input.tenantAdminTemporaryPassword,
      rotateClientSecret: input.rotateClientSecret,
    });

    return deps.getKeycloakStatus({
      instanceId: instance.instanceId,
      primaryHostname: instance.primaryHostname,
      authRealm: instance.authRealm,
      authClientId: instance.authClientId,
      authIssuerUrl: instance.authIssuerUrl,
      authClientSecretConfigured: instance.authClientSecretConfigured,
      authClientSecret: await loadRepositoryAuthClientSecret(deps.repository, instance.instanceId),
      tenantAdminBootstrap: instance.tenantAdminBootstrap,
    });
  };

export const createRuntimeResolver =
  (repository: InstanceRegistryRepository) =>
  async (host: string): Promise<ResolveRuntimeInstanceResult> => {
    const normalizedHost = normalizeHost(host);
    const instance = await repository.resolveHostname(normalizedHost);
    if (!instance) {
      return {
        hostClassification: {
          kind: 'invalid',
          normalizedHost,
          reason: 'unknown_host',
        },
        instance: null,
      };
    }

    return {
      hostClassification: classifyHost(normalizedHost, instance.parentDomain),
      instance: toListItem(instance),
    };
  };
