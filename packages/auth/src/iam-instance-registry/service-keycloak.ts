import { classifyHost, normalizeHost } from '@sva/core';
import { createSdkLogger } from '@sva/sdk/server';
import type { InstanceRegistryRepository } from '@sva/data';
import type { InstanceRegistryServiceDeps, ResolveRuntimeInstanceResult } from './types.js';
import { revealField } from '../iam-account-management/encryption.js';
import { toListItem } from './service-helpers.js';

const buildAuthClientSecretAad = (instanceId: string): string => `iam.instances.auth_client_secret:${instanceId}`;
const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

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
    logger.debug('keycloak_status_check_started', {
      operation: 'get_keycloak_status',
      instance_id: instanceId,
    });
    const instance = await deps.repository.getInstanceById(instanceId);
    if (!instance || !deps.getKeycloakStatus) {
      logger.debug('keycloak_status_check_skipped', {
        operation: 'get_keycloak_status',
        instance_id: instanceId,
        reason: !instance ? 'instance_not_found' : 'dependency_missing',
      });
      return null;
    }

    const status = await deps.getKeycloakStatus({
      instanceId: instance.instanceId,
      primaryHostname: instance.primaryHostname,
      authRealm: instance.authRealm,
      authClientId: instance.authClientId,
      authIssuerUrl: instance.authIssuerUrl,
      authClientSecretConfigured: instance.authClientSecretConfigured,
      authClientSecret: await loadRepositoryAuthClientSecret(deps.repository, instance.instanceId),
      tenantAdminBootstrap: instance.tenantAdminBootstrap,
    });
    logger.info('keycloak_status_check_completed', {
      operation: 'get_keycloak_status',
      instance_id: instance.instanceId,
    });
    return status;
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
    logger.info('keycloak_reconcile_started', {
      operation: 'reconcile_keycloak',
      instance_id: input.instanceId,
      request_id: input.requestId,
      actor_id: input.actorId,
      rotate_client_secret: Boolean(input.rotateClientSecret),
    });
    const instance = await deps.repository.getInstanceById(input.instanceId);
    if (!instance || !deps.provisionInstanceAuth || !deps.getKeycloakStatus) {
      logger.debug('keycloak_status_check_skipped', {
        operation: 'reconcile_keycloak',
        instance_id: input.instanceId,
        reason: !instance ? 'instance_not_found' : 'dependency_missing',
      });
      return null;
    }

    const authClientSecret = await loadRepositoryAuthClientSecret(deps.repository, input.instanceId);
    if (!authClientSecret) {
      logger.error('tenant_auth_client_secret_missing', {
        operation: 'reconcile_keycloak',
        instance_id: input.instanceId,
        request_id: input.requestId,
      });
      throw new Error('tenant_auth_client_secret_missing');
    }

    try {
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

      const status = await deps.getKeycloakStatus({
        instanceId: instance.instanceId,
        primaryHostname: instance.primaryHostname,
        authRealm: instance.authRealm,
        authClientId: instance.authClientId,
        authIssuerUrl: instance.authIssuerUrl,
        authClientSecretConfigured: instance.authClientSecretConfigured,
        authClientSecret: await loadRepositoryAuthClientSecret(deps.repository, instance.instanceId),
        tenantAdminBootstrap: instance.tenantAdminBootstrap,
      });
      logger.info('keycloak_reconcile_completed', {
        operation: 'reconcile_keycloak',
        instance_id: instance.instanceId,
        request_id: input.requestId,
      });
      return status;
    } catch (error) {
      logger.error('keycloak_reconcile_failed', {
        operation: 'reconcile_keycloak',
        instance_id: input.instanceId,
        request_id: input.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
