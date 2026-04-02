import {
  buildPrimaryHostname,
  canTransitionInstanceStatus,
  classifyHost,
  isTrafficEnabledInstanceStatus,
  normalizeHost,
  type HostClassification,
  type InstanceStatus,
  type IamInstanceAuditEvent,
  type IamInstanceDetail,
  type IamInstanceListItem,
} from '@sva/core';

import type { InstanceRegistryRepository } from '@sva/data';

export type InstanceRegistryMutationActor = {
  readonly actorId?: string;
  readonly requestId?: string;
};

export type CreateInstanceProvisioningInput = InstanceRegistryMutationActor & {
  readonly idempotencyKey: string;
  readonly instanceId: string;
  readonly displayName: string;
  readonly parentDomain: string;
  readonly themeKey?: string;
  readonly mainserverConfigRef?: string;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
};

export type ChangeInstanceStatusInput = InstanceRegistryMutationActor & {
  readonly idempotencyKey: string;
  readonly instanceId: string;
  readonly nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>;
};

export type CreateInstanceProvisioningResult =
  | { readonly ok: true; readonly instance: IamInstanceListItem }
  | { readonly ok: false; readonly reason: 'already_exists' };

export type ChangeInstanceStatusResult =
  | { readonly ok: true; readonly instance: IamInstanceListItem }
  | { readonly ok: false; readonly reason: 'not_found' | 'invalid_transition'; readonly currentStatus?: InstanceStatus };

export type ResolveRuntimeInstanceResult = {
  readonly hostClassification: HostClassification;
  readonly instance: IamInstanceListItem | null;
};

export type InstanceRegistryService = {
  listInstances(input?: {
    search?: string;
    status?: InstanceStatus;
  }): Promise<readonly IamInstanceListItem[]>;
  getInstanceDetail(instanceId: string): Promise<IamInstanceDetail | null>;
  createProvisioningRequest(input: CreateInstanceProvisioningInput): Promise<CreateInstanceProvisioningResult>;
  changeStatus(input: ChangeInstanceStatusInput): Promise<ChangeInstanceStatusResult>;
  resolveRuntimeInstance(host: string): Promise<ResolveRuntimeInstanceResult>;
  isTrafficAllowed(status: InstanceStatus): boolean;
};

export type InstanceRegistryServiceDeps = {
  readonly repository: InstanceRegistryRepository;
  readonly invalidateHost: (hostname: string) => void;
};

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
  async listInstances(input = {}) {
    const instances = await deps.repository.listInstances(input);
    return Promise.all(
      instances.map(async (instance) => {
        const latestProvisioningRun = (await deps.repository.listProvisioningRuns(instance.instanceId))[0];
        return toListItem(instance, latestProvisioningRun);
      })
    );
  },

  async getInstanceDetail(instanceId) {
    const instance = await deps.repository.getInstanceById(instanceId);
    if (!instance) {
      return null;
    }

    const [provisioningRuns, auditEvents] = await Promise.all([
      deps.repository.listProvisioningRuns(instanceId),
      deps.repository.listAuditEvents(instanceId),
    ]);

    return {
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
    };
  },

  async createProvisioningRequest(input) {
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

    await deps.repository.createProvisioningRun({
      instanceId: instance.instanceId,
      operation: 'create',
      status: 'requested',
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestId: input.requestId,
    });
    await deps.repository.appendAuditEvent({
      instanceId: instance.instanceId,
      eventType: 'instance_requested',
      actorId: input.actorId,
      requestId: input.requestId,
      details: createAuditDetails({
        parentDomain: instance.parentDomain,
        primaryHostname: instance.primaryHostname,
      }),
    });

    deps.invalidateHost(instance.primaryHostname);
    return {
      ok: true,
      instance: toListItem(instance),
    };
  },

  async changeStatus(input) {
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

    const operation = input.nextStatus === 'active' ? 'activate' : input.nextStatus === 'suspended' ? 'suspend' : 'archive';

    await deps.repository.createProvisioningRun({
      instanceId: input.instanceId,
      operation,
      status: input.nextStatus,
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestId: input.requestId,
    });
    await deps.repository.appendAuditEvent({
      instanceId: input.instanceId,
      eventType:
        input.nextStatus === 'active'
          ? 'instance_activated'
          : input.nextStatus === 'suspended'
            ? 'instance_suspended'
            : 'instance_archived',
      actorId: input.actorId,
      requestId: input.requestId,
      details: createAuditDetails({
        previousStatus: current.status,
        nextStatus: input.nextStatus,
      }),
    });

    deps.invalidateHost(updated.primaryHostname);
    return {
      ok: true,
      instance: toListItem(updated),
    };
  },

  async resolveRuntimeInstance(host) {
    const normalizedHost = normalizeHost(host);
    const instance = await deps.repository.resolveHostname(normalizedHost);
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
  },

  isTrafficAllowed(status) {
    return isTrafficEnabledInstanceStatus(status);
  },
});
