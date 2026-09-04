import { areAllInstanceKeycloakRequirementsSatisfied } from '@sva/core';

import type {
  InstanceStatus,
  IamInstanceDetail,
  IamInstanceKeycloakPlan,
  IamInstanceKeycloakPreflight,
  IamInstanceKeycloakProvisioningRun,
  IamInstanceListItem,
  IamTenantIamAxis,
  IamTenantIamStatus,
  WasteManagementSettingsRecord,
} from '@sva/core';

import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type { KeycloakTenantStatus } from './keycloak-types.js';
import type { ChangeInstanceStatusInput } from './mutation-types.js';
import {
  classifyTenantIamAxis,
  classifyTenantIamConfiguration,
  getTenantIamServiceIdentity,
} from './tenant-iam-evidence.js';

type InstanceRecord = Awaited<ReturnType<InstanceRegistryRepository['listInstances']>>[number];
type ProvisioningRun = Awaited<
  ReturnType<InstanceRegistryRepository['listProvisioningRuns']>
>[number];
type AuditEvent = Awaited<ReturnType<InstanceRegistryRepository['listAuditEvents']>>[number];

type TenantIamEvidence = Omit<IamTenantIamAxis, 'source'> & {
  readonly source: IamTenantIamAxis['source'];
};

const isConfigurationReady = (
  keycloakStatus: NonNullable<IamInstanceDetail['keycloakStatus']> | undefined
): boolean =>
  Boolean(keycloakStatus && areAllInstanceKeycloakRequirementsSatisfied(keycloakStatus));

const createTenantIamAxis = (input: TenantIamEvidence): IamTenantIamAxis => {
  const serviceIdentity = input.serviceIdentity ?? getTenantIamServiceIdentity(input.source);
  const classification = input.classification ?? classifyTenantIamAxis(input);
  return {
    status: input.status,
    summary: input.summary,
    source: input.source,
    ...(serviceIdentity ? { serviceIdentity } : {}),
    classification,
    ...(input.checkedAt ? { checkedAt: input.checkedAt } : {}),
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
  };
};

const tenantIamPrecedence: ReadonlyArray<IamTenantIamAxis['status']> = [
  'blocked',
  'degraded',
  'unknown',
  'ready',
];

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
        classification: classifyTenantIamConfiguration(input.keycloakStatus),
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
      serviceIdentity: dominantAxis.serviceIdentity,
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
  assignedModules: item.assignedModules,
  mainserverConfigRef: item.mainserverConfigRef,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  latestProvisioningRun,
});

export const buildModuleIamStatus = (
  assignedModules: readonly string[],
  contracts: ReadonlyMap<
    string,
    {
      permissionIds: readonly string[];
      tenantBootstrapRoles?: readonly { roleName: string }[];
      systemRoles?: readonly { roleName: string }[];
    }
  >
): IamInstanceDetail['moduleIamStatus'] => {
  if (assignedModules.length === 0) {
    return {
      overall: {
        status: 'unknown',
        summary: 'Noch keine Module für diese Instanz zugewiesen.',
        source: 'registry',
      },
      modules: [],
    };
  }

  const modules = assignedModules.map((moduleId) => {
    const contract = contracts.get(moduleId);
    if (!contract) {
      return {
        moduleId,
        status: 'blocked' as const,
        summary: 'Für dieses Modul fehlt der deklarative IAM-Vertrag.',
        source: 'registry' as const,
        permissionIds: [],
        systemRoleNames: [],
      };
    }

    return {
      moduleId,
      status: 'ready' as const,
      summary: 'IAM-Basis des Moduls ist deklarativ registriert.',
      source: 'registry' as const,
      permissionIds: contract.permissionIds,
      systemRoleNames: (contract.systemRoles ?? contract.tenantBootstrapRoles ?? []).map(
        (role) => role.roleName
      ),
    };
  });

  const overallStatus = modules.some((module) => module.status === 'blocked') ? 'blocked' : 'ready';

  return {
    overall: {
      status: overallStatus,
      summary:
        overallStatus === 'ready'
          ? 'IAM-Basis der zugewiesenen Module ist vollständig registriert.'
          : 'Mindestens ein zugewiesenes Modul hat keinen vollständigen IAM-Vertrag.',
      source: 'registry',
    },
    modules,
  };
};

export const buildInstanceDetail = (
  instance: Exclude<Awaited<ReturnType<InstanceRegistryRepository['getInstanceById']>>, null>,
  provisioningRuns: readonly ProvisioningRun[],
  auditEvents: readonly AuditEvent[],
  moduleActivations: IamInstanceDetail['moduleActivations'],
  keycloakStatus?: KeycloakTenantStatus,
  keycloakPreflight?: IamInstanceKeycloakPreflight,
  keycloakPlan?: IamInstanceKeycloakPlan,
  keycloakProvisioningRuns: readonly IamInstanceKeycloakProvisioningRun[] = [],
  tenantIamStatus?: IamTenantIamStatus,
  moduleIamStatus?: IamInstanceDetail['moduleIamStatus'],
  wasteManagementSettings?: WasteManagementSettingsRecord
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
  moduleActivations,
  keycloakStatus,
  keycloakPreflight,
  keycloakPlan,
  latestKeycloakProvisioningRun: keycloakProvisioningRuns[0],
  keycloakProvisioningRuns,
  tenantIamStatus,
  moduleIamStatus,
  wasteManagementSettings,
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
