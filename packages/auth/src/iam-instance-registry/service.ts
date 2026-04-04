import {
  buildPrimaryHostname,
  canTransitionInstanceStatus,
  isTrafficEnabledInstanceStatus,
  normalizeHost,
} from '@sva/core';
import { createSdkLogger } from '@sva/sdk/server';
import { protectField } from '../iam-account-management/encryption.js';

import type { InstanceRegistryRepository } from '@sva/data';
import type {
  CreateInstanceProvisioningInput,
  InstanceRegistryService,
  InstanceRegistryServiceDeps,
  ResolveRuntimeInstanceResult,
  UpdateInstanceInput,
} from './types.js';
import {
  buildInstanceDetail,
  createStatusArtifacts,
  toListItem,
} from './service-helpers.js';
import {
  createGetKeycloakStatusHandler,
  createReconcileKeycloakHandler,
  createRuntimeResolver,
  loadRepositoryAuthClientSecret,
} from './service-keycloak.js';
import { createProvisioningArtifacts, provisionInstanceAuth } from './service-provisioning.js';

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

export const createInstanceRegistryService = (deps: InstanceRegistryServiceDeps): InstanceRegistryService => ({
  listInstances: createListInstances(deps.repository),
  getInstanceDetail: createGetInstanceDetail(deps.repository),
  createProvisioningRequest: createProvisioningRequestHandler(deps),
  updateInstance: createUpdateInstanceHandler(deps),
  changeStatus: createChangeStatusHandler(deps),
  getKeycloakStatus: createGetKeycloakStatusHandler(deps),
  reconcileKeycloak: createReconcileKeycloakHandler(deps),
  resolveRuntimeInstance: createRuntimeResolver(deps.repository),
  isTrafficAllowed: isTrafficEnabledInstanceStatus,
});

const encryptAuthClientSecret = (instanceId: string, secret: string | undefined): string | undefined => {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return undefined;
  }
  return protectField(normalizedSecret, `iam.instances.auth_client_secret:${instanceId}`) ?? undefined;
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

const createGetInstanceDetail =
  (repository: InstanceRegistryRepository): InstanceRegistryService['getInstanceDetail'] =>
  async (instanceId) => {
    const instance = await repository.getInstanceById(instanceId);
    if (!instance) {
      return null;
    }

    const [provisioningRuns, auditEvents] = await Promise.all([
      repository.listProvisioningRuns(instanceId),
      repository.listAuditEvents(instanceId),
    ]);

    return buildInstanceDetail(instance, provisioningRuns, auditEvents);
  };

const createProvisioningRequestHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['createProvisioningRequest'] =>
  async (input) => {
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
      return { ok: false, reason: 'already_exists' };
    }

    const normalizedParentDomain = normalizeHost(input.parentDomain);
    const primaryHostname = buildPrimaryHostname(input.instanceId, normalizedParentDomain);
    const instance = await deps.repository.createInstance({
      instanceId: input.instanceId,
      displayName: input.displayName,
      status: 'requested',
      parentDomain: normalizedParentDomain,
      primaryHostname,
      authRealm: input.authRealm,
      authClientId: input.authClientId,
      authIssuerUrl: input.authIssuerUrl,
      authClientSecretCiphertext: encryptAuthClientSecret(input.instanceId, input.authClientSecret),
      tenantAdminBootstrap: input.tenantAdminBootstrap,
      actorId: input.actorId,
      requestId: input.requestId,
      themeKey: input.themeKey,
      featureFlags: input.featureFlags,
      mainserverConfigRef: input.mainserverConfigRef,
    });

    await createProvisioningArtifacts(deps.repository, instance, input);
    const provisionedInstance = await provisionInstanceAuth(deps, instance, input);
    invalidateHostWithLog(deps.invalidateHost, provisionedInstance.primaryHostname, provisionedInstance.instanceId);
    logger.info('instance_create_completed', {
      operation: 'create_instance',
      instance_id: provisionedInstance.instanceId,
      status: provisionedInstance.status,
      request_id: input.requestId,
    });
    return { ok: true, instance: toListItem(provisionedInstance) };
  };

const createChangeStatusHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['changeStatus'] =>
  async (input) => {
    const current = await deps.repository.getInstanceById(input.instanceId);
    if (!current) {
      return { ok: false, reason: 'not_found' };
    }

    if (!canTransitionInstanceStatus(current.status, input.nextStatus)) {
      logger.warn('instance_status_transition_rejected', {
        operation: 'change_instance_status',
        instance_id: input.instanceId,
        current_status: current.status,
        next_status: input.nextStatus,
        request_id: input.requestId,
      });
      return { ok: false, reason: 'invalid_transition', currentStatus: current.status };
    }

    const updated = await deps.repository.setInstanceStatus({
      instanceId: input.instanceId,
      status: input.nextStatus,
      actorId: input.actorId,
      requestId: input.requestId,
    });
    if (!updated) {
      return { ok: false, reason: 'not_found' };
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
      authRealm: input.authRealm,
      authClientId: input.authClientId,
      authIssuerUrl: input.authIssuerUrl,
      authClientSecretCiphertext: encryptAuthClientSecret(input.instanceId, input.authClientSecret),
      keepExistingAuthClientSecret: !input.authClientSecret?.trim(),
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

    const [provisioningRuns, auditEvents, keycloakStatus] = await Promise.all([
      deps.repository.listProvisioningRuns(updated.instanceId),
      deps.repository.listAuditEvents(updated.instanceId),
      deps.getKeycloakStatus?.({
        instanceId: updated.instanceId,
        primaryHostname: updated.primaryHostname,
        authRealm: updated.authRealm,
        authClientId: updated.authClientId,
        authIssuerUrl: updated.authIssuerUrl,
        authClientSecretConfigured: updated.authClientSecretConfigured,
        authClientSecret: await loadRepositoryAuthClientSecret(deps.repository, updated.instanceId),
        tenantAdminBootstrap: updated.tenantAdminBootstrap,
      }) ?? Promise.resolve(undefined),
    ]);

    logger.info('instance_update_completed', {
      operation: 'update_instance',
      instance_id: updated.instanceId,
      request_id: input.requestId,
      previous_hostname: existing.primaryHostname,
      next_hostname: updated.primaryHostname,
    });
    return buildInstanceDetail(updated, provisioningRuns, auditEvents, keycloakStatus);
  };
