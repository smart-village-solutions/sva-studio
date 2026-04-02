import {
  buildPrimaryHostname,
  canTransitionInstanceStatus,
  classifyHost,
  isTrafficEnabledInstanceStatus,
  normalizeHost,
  type InstanceStatus,
  type IamInstanceDetail,
  type IamInstanceListItem,
} from '@sva/core';

import type { InstanceRegistryRepository } from '@sva/data';
import type {
  ChangeInstanceStatusInput,
  CreateInstanceProvisioningInput,
  InstanceRegistryService,
  InstanceRegistryServiceDeps,
  ResolveRuntimeInstanceResult,
} from './types.js';

const toListItem = (
  item: Awaited<ReturnType<InstanceRegistryRepository['listInstances']>>[number],
  latestProvisioningRun?: Awaited<ReturnType<InstanceRegistryRepository['listProvisioningRuns']>>[number]
): IamInstanceListItem => ({
  instanceId: item.instanceId,
  displayName: item.displayName,
  status: item.status,
  parentDomain: item.parentDomain,
  primaryHostname: item.primaryHostname,
  themeKey: item.themeKey,
  featureFlags: item.featureFlags,
  mainserverConfigRef: item.mainserverConfigRef,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  latestProvisioningRun,
});

const createAuditDetails = (
  input?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => input ?? {};

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

const buildInstanceDetail = (
  instance: Awaited<ReturnType<InstanceRegistryRepository['getInstanceById']>> extends infer T ? Exclude<T, null> : never,
  provisioningRuns: Awaited<ReturnType<InstanceRegistryRepository['listProvisioningRuns']>>,
  auditEvents: Awaited<ReturnType<InstanceRegistryRepository['listAuditEvents']>>
): IamInstanceDetail => ({
  ...toListItem(instance, provisioningRuns[0]),
  hostnames: [
    {
      hostname: instance.primaryHostname,
      isPrimary: true,
      createdAt: instance.createdAt,
    },
  ],
  provisioningRuns,
  auditEvents,
});

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
      actorId: input.actorId,
      requestId: input.requestId,
      themeKey: input.themeKey,
      featureFlags: input.featureFlags,
      mainserverConfigRef: input.mainserverConfigRef,
    });

    await createProvisioningArtifacts(deps.repository, instance, input);
    deps.invalidateHost(instance.primaryHostname);
    return { ok: true, instance: toListItem(instance) };
  };

const getStatusOperation = (status: ChangeInstanceStatusInput['nextStatus']): 'activate' | 'suspend' | 'archive' =>
  status === 'active' ? 'activate' : status === 'suspended' ? 'suspend' : 'archive';

const getAuditEventType = (status: ChangeInstanceStatusInput['nextStatus']): 'instance_activated' | 'instance_suspended' | 'instance_archived' =>
  status === 'active' ? 'instance_activated' : status === 'suspended' ? 'instance_suspended' : 'instance_archived';

const createStatusArtifacts = async (
  repository: InstanceRegistryRepository,
  input: ChangeInstanceStatusInput,
  previousStatus: InstanceStatus
): Promise<void> => {
  await repository.createProvisioningRun({
    instanceId: input.instanceId,
    operation: getStatusOperation(input.nextStatus),
    status: input.nextStatus,
    idempotencyKey: input.idempotencyKey,
    actorId: input.actorId,
    requestId: input.requestId,
  });
  await repository.appendAuditEvent({
    instanceId: input.instanceId,
    eventType: getAuditEventType(input.nextStatus),
    actorId: input.actorId,
    requestId: input.requestId,
    details: createAuditDetails({
      previousStatus,
      nextStatus: input.nextStatus,
    }),
  });
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
