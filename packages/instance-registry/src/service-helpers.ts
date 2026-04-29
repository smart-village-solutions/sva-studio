import type {
  InstanceStatus,
  IamInstanceDetail,
  IamInstanceKeycloakPlan,
  IamInstanceKeycloakPreflight,
  IamInstanceKeycloakProvisioningRun,
  IamInstanceListItem,
  IamTenantIamAxis,
  IamTenantIamStatus,
} from '@sva/core';

import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type { KeycloakTenantStatus } from './keycloak-types.js';
import type { ChangeInstanceStatusInput } from './mutation-types.js';

type InstanceRecord = Awaited<ReturnType<InstanceRegistryRepository['listInstances']>>[number];
type ProvisioningRun = Awaited<ReturnType<InstanceRegistryRepository['listProvisioningRuns']>>[number];
type AuditEvent = Awaited<ReturnType<InstanceRegistryRepository['listAuditEvents']>>[number];

type TenantIamEvidence = Omit<IamTenantIamAxis, 'source'> & {
  readonly source: IamTenantIamAxis['source'];
};

const createTenantIamAxis = (input: TenantIamEvidence): IamTenantIamAxis => ({
  status: input.status,
  summary: input.summary,
  source: input.source,
  ...(input.checkedAt ? { checkedAt: input.checkedAt } : {}),
  ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  ...(input.requestId ? { requestId: input.requestId } : {}),
});

const isConfigurationReady = (
  keycloakStatus: NonNullable<IamInstanceDetail['keycloakStatus']> | undefined
): boolean =>
  Boolean(
    keycloakStatus?.realmExists &&
      keycloakStatus.clientExists &&
      keycloakStatus.tenantAdminClientExists &&
      keycloakStatus.instanceIdMapperExists &&
      keycloakStatus.tenantAdminExists &&
      keycloakStatus.tenantAdminHasSystemAdmin &&
      keycloakStatus.tenantAdminHasInstanceRegistryAdmin &&
      keycloakStatus.tenantAdminInstanceIdMatches &&
      keycloakStatus.redirectUrisMatch &&
      keycloakStatus.logoutUrisMatch &&
      keycloakStatus.webOriginsMatch &&
      keycloakStatus.clientSecretConfigured &&
      keycloakStatus.tenantClientSecretReadable &&
      keycloakStatus.clientSecretAligned &&
      keycloakStatus.tenantAdminClientSecretConfigured &&
      keycloakStatus.tenantAdminClientSecretReadable &&
      keycloakStatus.tenantAdminClientSecretAligned
  );

const tenantIamPrecedence: ReadonlyArray<IamTenantIamAxis['status']> = ['blocked', 'degraded', 'unknown', 'ready'];

export const buildTenantIamStatus = (input: {
  keycloakStatus?: IamInstanceDetail['keycloakStatus'];
  accessEvidence?: TenantIamEvidence;
  reconcileEvidence?: TenantIamEvidence;
}): IamTenantIamStatus => {
  const configuration = input.keycloakStatus
    ? createTenantIamAxis({
        status: isConfigurationReady(input.keycloakStatus) ? 'ready' : 'degraded',
        summary: isConfigurationReady(input.keycloakStatus)
          ? 'Tenant-IAM-Struktur ist vollständig vorhanden.'
          : 'Tenant-IAM-Struktur ist unvollständig oder driftet.',
        source: 'keycloak_status_snapshot',
      })
    : createTenantIamAxis({
        status: 'unknown',
        summary: 'Noch kein Strukturstatus für Tenant-IAM vorhanden.',
        source: 'registry',
      });

  const access = input.accessEvidence
    ? createTenantIamAxis(input.accessEvidence)
    : createTenantIamAxis({
        status: 'unknown',
        summary: 'Noch keine tenantlokale Rechteprobe vorhanden.',
        source: 'access_probe',
      });

  const reconcile = input.reconcileEvidence
    ? createTenantIamAxis(input.reconcileEvidence)
    : createTenantIamAxis({
        status: 'unknown',
        summary: 'Noch kein Rollenabgleich ausgeführt.',
        source: 'role_reconcile',
      });

  const overallStatus =
    tenantIamPrecedence.find((candidate) =>
      [configuration.status, access.status, reconcile.status].includes(candidate)
    ) ?? 'unknown';

  const dominantAxis =
    overallStatus === configuration.status
      ? configuration
      : overallStatus === access.status
        ? access
        : overallStatus === reconcile.status
          ? reconcile
          : configuration;

  const overallSummary =
    overallStatus === 'ready'
      ? 'Tenant-IAM ist betriebsbereit.'
      : overallStatus === 'blocked'
        ? 'Tenant-IAM ist blockiert.'
        : overallStatus === 'degraded'
          ? 'Tenant-IAM ist eingeschränkt.'
          : 'Tenant-IAM-Befund ist unvollständig.';

  return {
    configuration,
    access,
    reconcile,
    overall: createTenantIamAxis({
      status: overallStatus,
      summary: overallSummary,
      source: overallStatus === 'unknown' ? 'registry' : dominantAxis.source,
      checkedAt: dominantAxis.checkedAt,
      errorCode: dominantAxis.errorCode,
      requestId: dominantAxis.requestId,
    }),
  };
};

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
  keycloakProvisioningRuns: readonly IamInstanceKeycloakProvisioningRun[] = [],
  tenantIamStatus?: IamTenantIamStatus
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
  tenantIamStatus,
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
