import {
  buildPrimaryHostname,
  canTransitionInstanceStatus,
  classifyHost,
  isTrafficEnabledInstanceStatus,
  normalizeHost,
} from '@sva/core';

import type { InstanceRegistryRepository } from '@sva/data';
import type {
  ChangeInstanceStatusInput,
  CreateInstanceProvisioningInput,
  InstanceRegistryService,
  InstanceRegistryServiceDeps,
  ResolveRuntimeInstanceResult,
} from './types.js';
import {
  buildInstanceDetail,
  createAuditDetails,
  createStatusArtifacts,
  toListItem,
} from './service-helpers.js';

export const createInstanceRegistryService = (deps: InstanceRegistryServiceDeps): InstanceRegistryService => ({
  listInstances: createListInstances(deps.repository),
  getInstanceDetail: createGetInstanceDetail(deps.repository),
  createProvisioningRequest: createProvisioningRequestHandler(deps),
  changeStatus: createChangeStatusHandler(deps),
  resolveRuntimeInstance: createRuntimeResolver(deps.repository),
  isTrafficAllowed: isTrafficEnabledInstanceStatus,
});

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

const createProvisioningArtifacts = async (
  repository: InstanceRegistryRepository,
  instance: Awaited<ReturnType<InstanceRegistryRepository['createInstance']>>,
  input: CreateInstanceProvisioningInput
): Promise<void> => {
  await repository.createProvisioningRun({
    instanceId: instance.instanceId,
    operation: 'create',
    status: 'requested',
    idempotencyKey: input.idempotencyKey,
    actorId: input.actorId,
    requestId: input.requestId,
  });
  await repository.appendAuditEvent({
    instanceId: instance.instanceId,
    eventType: 'instance_requested',
    actorId: input.actorId,
    requestId: input.requestId,
    details: createAuditDetails({
      parentDomain: instance.parentDomain,
      primaryHostname: instance.primaryHostname,
    }),
  });
};

const provisionInstanceAuth = async (
  deps: InstanceRegistryServiceDeps,
  instance: Awaited<ReturnType<InstanceRegistryRepository['createInstance']>>,
  input: CreateInstanceProvisioningInput
): Promise<Awaited<ReturnType<InstanceRegistryRepository['createInstance']>>> => {
  if (!deps.provisionInstanceAuth) {
    return instance;
  }

  await deps.repository.createProvisioningRun({
    instanceId: instance.instanceId,
    operation: 'create',
    status: 'provisioning',
    stepKey: 'keycloak',
    idempotencyKey: input.idempotencyKey,
    actorId: input.actorId,
    requestId: input.requestId,
  });

  try {
    await deps.provisionInstanceAuth({
      instanceId: instance.instanceId,
      primaryHostname: instance.primaryHostname,
      authRealm: instance.authRealm,
      authClientId: instance.authClientId,
      authIssuerUrl: instance.authIssuerUrl,
    });

    const validatedInstance =
      (await deps.repository.setInstanceStatus({
        instanceId: instance.instanceId,
        status: 'validated',
        actorId: input.actorId,
        requestId: input.requestId,
      })) ?? instance;

    await deps.repository.createProvisioningRun({
      instanceId: instance.instanceId,
      operation: 'create',
      status: validatedInstance.status,
      stepKey: 'keycloak',
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestId: input.requestId,
    });

    return validatedInstance;
  } catch (error) {
    const failedInstance =
      (await deps.repository.setInstanceStatus({
        instanceId: instance.instanceId,
        status: 'failed',
        actorId: input.actorId,
        requestId: input.requestId,
      })) ?? instance;

    await deps.repository.createProvisioningRun({
      instanceId: instance.instanceId,
      operation: 'create',
      status: failedInstance.status,
      stepKey: 'keycloak',
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestId: input.requestId,
      errorCode: 'keycloak_provisioning_failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return failedInstance;
  }
};

const createProvisioningRequestHandler =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['createProvisioningRequest'] =>
  async (input) => {
    const existing = await deps.repository.getInstanceById(input.instanceId);
    if (existing) {
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
      actorId: input.actorId,
      requestId: input.requestId,
      themeKey: input.themeKey,
      featureFlags: input.featureFlags,
      mainserverConfigRef: input.mainserverConfigRef,
    });

    await createProvisioningArtifacts(deps.repository, instance, input);
    const provisionedInstance = await provisionInstanceAuth(deps, instance, input);
    deps.invalidateHost(provisionedInstance.primaryHostname);
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
    deps.invalidateHost(updated.primaryHostname);
    return { ok: true, instance: toListItem(updated) };
  };

const createRuntimeResolver =
  (repository: InstanceRegistryRepository): InstanceRegistryService['resolveRuntimeInstance'] =>
  async (host): Promise<ResolveRuntimeInstanceResult> => {
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
