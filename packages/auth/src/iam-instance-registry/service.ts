import { buildPrimaryHostname, canTransitionInstanceStatus, isTrafficEnabledInstanceStatus, normalizeHost } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';
import { protectField } from '../iam-account-management/encryption.js';

import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type { CreateInstanceProvisioningInput, UpdateInstanceInput } from '@sva/instance-registry';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';
import { createStatusArtifacts, toListItem } from './service-helpers.js';
import { createGetInstanceDetail } from './service-detail.js';
import {
  createExecuteKeycloakProvisioningHandler,
  createGetKeycloakPreflightHandler,
  createGetKeycloakProvisioningRunHandler,
  createGetKeycloakStatusHandler,
  createPlanKeycloakProvisioningHandler,
  createReconcileKeycloakHandler,
  createRuntimeResolver,
} from './service-keycloak.js';
import { createProvisioningArtifacts } from './service-provisioning.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-service', level: 'info' });

const invalidateHostWithLog = (
  invalidateHost: InstanceRegistryServiceDeps['invalidateHost'],
  hostname: string,
  instanceId: string
): void => {
  invalidateHost(hostname);
  logger.debug('instance_host_cache_invalidated', {
    operation: 'invalidate_host',
    instance_id: instanceId,
    hostname,
  });
};

const encryptAuthClientSecret = (instanceId: string, secret: string | undefined): string | undefined => {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return undefined;
  }
  return protectField(normalizedSecret, `iam.instances.auth_client_secret:${instanceId}`) ?? undefined;
};

const encryptTenantAdminClientSecret = (instanceId: string, secret: string | undefined): string | undefined => {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return undefined;
  }
  return protectField(normalizedSecret, `iam.instances.tenant_admin_client_secret:${instanceId}`) ?? undefined;
};

const createListInstances =
  (repository: InstanceRegistryRepository): InstanceRegistryService['listInstances'] =>
  async (input = {}) => {
    const instances = await repository.listInstances(input);
    const latestProvisioningRuns = await repository.listLatestProvisioningRuns(
      instances.map((instance) => instance.instanceId)
    );

    return instances.map((instance) => toListItem(instance, latestProvisioningRuns[instance.instanceId]));
  };

const createProvisioningRequestHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['createProvisioningRequest'] =>
  async (input: CreateInstanceProvisioningInput) => {
    logger.info('instance_create_requested', {
      operation: 'create_instance',
      instance_id: input.instanceId,
      request_id: input.requestId,
      actor_id: input.actorId,
    });
    const existing = await deps.repository.getInstanceById(input.instanceId);
    if (existing) {
      logger.warn('instance_create_rejected_duplicate', {
        operation: 'create_instance',
        instance_id: input.instanceId,
        request_id: input.requestId,
      });
      return { ok: false, reason: 'already_exists' as const };
    }

    const normalizedParentDomain = normalizeHost(input.parentDomain);
    const primaryHostname = buildPrimaryHostname(input.instanceId, normalizedParentDomain);
    const instance = await deps.repository.createInstance({
      instanceId: input.instanceId,
      displayName: input.displayName,
      status: 'requested',
      parentDomain: normalizedParentDomain,
      primaryHostname,
      realmMode: input.realmMode,
      authRealm: input.authRealm,
      authClientId: input.authClientId,
      authIssuerUrl: input.authIssuerUrl,
      authClientSecretCiphertext: encryptAuthClientSecret(input.instanceId, input.authClientSecret),
      tenantAdminClient: input.tenantAdminClient
        ? {
            clientId: input.tenantAdminClient.clientId,
            secretCiphertext: encryptTenantAdminClientSecret(input.instanceId, input.tenantAdminClient.secret),
          }
        : undefined,
      tenantAdminBootstrap: input.tenantAdminBootstrap,
      actorId: input.actorId,
      requestId: input.requestId,
      themeKey: input.themeKey,
      featureFlags: input.featureFlags,
      mainserverConfigRef: input.mainserverConfigRef,
    });

    await createProvisioningArtifacts(deps.repository, instance, input);
    invalidateHostWithLog(deps.invalidateHost, instance.primaryHostname, instance.instanceId);
    logger.info('instance_create_completed', {
      operation: 'create_instance',
      instance_id: instance.instanceId,
      status: instance.status,
      request_id: input.requestId,
    });
    return { ok: true, instance: toListItem(instance) };
  };

const createChangeStatusHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['changeStatus'] =>
  async (input) => {
    const current = await deps.repository.getInstanceById(input.instanceId);
    if (!current) {
      return { ok: false, reason: 'not_found' as const };
    }

    if (!canTransitionInstanceStatus(current.status, input.nextStatus)) {
      logger.warn('instance_status_transition_rejected', {
        operation: 'change_instance_status',
        instance_id: input.instanceId,
        current_status: current.status,
        next_status: input.nextStatus,
        request_id: input.requestId,
      });
      return { ok: false, reason: 'invalid_transition' as const, currentStatus: current.status };
    }

    const updated = await deps.repository.setInstanceStatus({
      instanceId: input.instanceId,
      status: input.nextStatus,
      actorId: input.actorId,
      requestId: input.requestId,
    });
    if (!updated) {
      return { ok: false, reason: 'not_found' as const };
    }

    await createStatusArtifacts(deps.repository, input, current.status);
    invalidateHostWithLog(deps.invalidateHost, updated.primaryHostname, updated.instanceId);
    logger.info('instance_status_transition_completed', {
      operation: 'change_instance_status',
      instance_id: updated.instanceId,
      previous_status: current.status,
      next_status: updated.status,
      request_id: input.requestId,
    });
    return { ok: true, instance: toListItem(updated) };
  };

const createUpdateInstanceHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['updateInstance'] =>
  async (input: UpdateInstanceInput) => {
    logger.info('instance_update_started', {
      operation: 'update_instance',
      instance_id: input.instanceId,
      request_id: input.requestId,
      actor_id: input.actorId,
    });
    const existing = await deps.repository.getInstanceById(input.instanceId);
    if (!existing) {
      return null;
    }

    const normalizedParentDomain = normalizeHost(input.parentDomain);
    const primaryHostname = buildPrimaryHostname(input.instanceId, normalizedParentDomain);
    const updated = await deps.repository.updateInstance({
      instanceId: input.instanceId,
      displayName: input.displayName,
      parentDomain: normalizedParentDomain,
      primaryHostname,
      realmMode: input.realmMode,
      authRealm: input.authRealm,
      authClientId: input.authClientId,
      authIssuerUrl: input.authIssuerUrl,
      authClientSecretCiphertext: encryptAuthClientSecret(input.instanceId, input.authClientSecret),
      keepExistingAuthClientSecret: !input.authClientSecret?.trim(),
      tenantAdminClient: input.tenantAdminClient
        ? {
            clientId: input.tenantAdminClient.clientId,
            secretCiphertext: encryptTenantAdminClientSecret(input.instanceId, input.tenantAdminClient.secret),
          }
        : undefined,
      keepExistingTenantAdminClientSecret: !input.tenantAdminClient?.secret?.trim(),
      tenantAdminBootstrap: input.tenantAdminBootstrap,
      actorId: input.actorId,
      requestId: input.requestId,
      themeKey: input.themeKey,
      featureFlags: input.featureFlags,
      mainserverConfigRef: input.mainserverConfigRef,
    });
    if (!updated) {
      return null;
    }

    invalidateHostWithLog(deps.invalidateHost, existing.primaryHostname, updated.instanceId);
    invalidateHostWithLog(deps.invalidateHost, updated.primaryHostname, updated.instanceId);

    logger.info('instance_update_completed', {
      operation: 'update_instance',
      instance_id: updated.instanceId,
      request_id: input.requestId,
      previous_hostname: existing.primaryHostname,
      next_hostname: updated.primaryHostname,
    });
    return createGetInstanceDetail(deps)(updated.instanceId);
  };

export const createInstanceRegistryService = (deps: InstanceRegistryServiceDeps): InstanceRegistryService => ({
  listInstances: createListInstances(deps.repository),
  getInstanceDetail: createGetInstanceDetail(deps),
  createProvisioningRequest: createProvisioningRequestHandler(deps),
  updateInstance: createUpdateInstanceHandler(deps),
  changeStatus: createChangeStatusHandler(deps),
  getKeycloakPreflight: createGetKeycloakPreflightHandler(deps),
  planKeycloakProvisioning: createPlanKeycloakProvisioningHandler(deps),
  executeKeycloakProvisioning: createExecuteKeycloakProvisioningHandler(deps),
  getKeycloakProvisioningRun: createGetKeycloakProvisioningRunHandler(deps),
  getKeycloakStatus: createGetKeycloakStatusHandler(deps),
  reconcileKeycloak: createReconcileKeycloakHandler(deps),
  resolveRuntimeInstance: createRuntimeResolver(deps.repository),
  isTrafficAllowed: isTrafficEnabledInstanceStatus,
});
