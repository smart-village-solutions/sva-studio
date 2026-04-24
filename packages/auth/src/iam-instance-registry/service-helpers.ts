import type {
  InstanceStatus,
  IamInstanceDetail,
  IamInstanceKeycloakPlan,
  IamInstanceKeycloakPreflight,
  IamInstanceKeycloakProvisioningRun,
  IamInstanceListItem,
} from '@sva/core';

import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type { ChangeInstanceStatusInput } from '@sva/instance-registry';
import type { KeycloakTenantStatus } from '@sva/instance-registry';

type InstanceRecord = Awaited<ReturnType<InstanceRegistryRepository['listInstances']>>[number];
type ProvisioningRun = Awaited<ReturnType<InstanceRegistryRepository['listProvisioningRuns']>>[number];
type AuditEvent = Awaited<ReturnType<InstanceRegistryRepository['listAuditEvents']>>[number];

export const toListItem = (
  item: InstanceRecord,
  latestProvisioningRun?: ProvisioningRun
): IamInstanceListItem => ({
  instanceId: item.instanceId,
  displayName: item.displayName,
  status: item.status,
  parentDomain: item.parentDomain,
  primaryHostname: item.primaryHostname,
  realmMode: item.realmMode,
  authRealm: item.authRealm,
  authClientId: item.authClientId,
  authIssuerUrl: item.authIssuerUrl,
  authClientSecretConfigured: item.authClientSecretConfigured,
  tenantAdminClient: item.tenantAdminClient,
  tenantAdminBootstrap: item.tenantAdminBootstrap,
  themeKey: item.themeKey,
  featureFlags: item.featureFlags,
  mainserverConfigRef: item.mainserverConfigRef,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  latestProvisioningRun,
});

export const buildInstanceDetail = (
  instance: Exclude<Awaited<ReturnType<InstanceRegistryRepository['getInstanceById']>>, null>,
  provisioningRuns: readonly ProvisioningRun[],
  auditEvents: readonly AuditEvent[],
  keycloakStatus?: KeycloakTenantStatus,
  keycloakPreflight?: IamInstanceKeycloakPreflight,
  keycloakPlan?: IamInstanceKeycloakPlan,
  keycloakProvisioningRuns: readonly IamInstanceKeycloakProvisioningRun[] = []
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
  keycloakStatus,
  keycloakPreflight,
  keycloakPlan,
  latestKeycloakProvisioningRun: keycloakProvisioningRuns[0],
  keycloakProvisioningRuns,
});

export const createAuditDetails = (
  input?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => input ?? {};

export const getStatusOperation = (
  status: ChangeInstanceStatusInput['nextStatus']
): 'activate' | 'suspend' | 'archive' => {
  if (status === 'active') {
    return 'activate';
  }
  if (status === 'suspended') {
    return 'suspend';
  }
  return 'archive';
};

export const getAuditEventType = (
  status: ChangeInstanceStatusInput['nextStatus']
): 'instance_activated' | 'instance_suspended' | 'instance_archived' => {
  if (status === 'active') {
    return 'instance_activated';
  }
  if (status === 'suspended') {
    return 'instance_suspended';
  }
  return 'instance_archived';
};

export const createStatusArtifacts = async (
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
