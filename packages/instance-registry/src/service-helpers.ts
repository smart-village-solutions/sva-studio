import {
  areAllInstanceKeycloakRequirementsSatisfied,
} from '@sva/core';

import type {
  InstanceStatus,
  IamInstanceAssignedModule,
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
): boolean => Boolean(keycloakStatus && areAllInstanceKeycloakRequirementsSatisfied(keycloakStatus));

const tenantIamPrecedence: ReadonlyArray<IamTenantIamAxis['status']> = ['blocked', 'degraded', 'unknown', 'ready'];

const createUnknownTenantIamAxis = (
  source: IamTenantIamAxis['source'],
  summary: string
): IamTenantIamAxis =>
  createTenantIamAxis({
    status: 'unknown',
    summary,
    source,
  });

const buildConfigurationTenantIamAxis = (
  keycloakStatus?: IamInstanceDetail['keycloakStatus']
): IamTenantIamAxis => {
  if (!keycloakStatus) {
    return createUnknownTenantIamAxis('registry', 'Noch kein Strukturstatus für Tenant-IAM vorhanden.');
  }

  const configurationReady = isConfigurationReady(keycloakStatus);
  return createTenantIamAxis({
    status: configurationReady ? 'ready' : 'degraded',
    summary: configurationReady
      ? 'Tenant-IAM-Struktur ist vollständig vorhanden.'
      : 'Tenant-IAM-Struktur ist unvollständig oder driftet.',
    source: 'keycloak_status_snapshot',
  });
};

const buildEvidenceTenantIamAxis = (
  evidence: TenantIamEvidence | undefined,
  fallback: { readonly source: IamTenantIamAxis['source']; readonly summary: string }
): IamTenantIamAxis => (evidence ? createTenantIamAxis(evidence) : createUnknownTenantIamAxis(fallback.source, fallback.summary));

const resolveTenantIamOverallStatus = (axes: readonly IamTenantIamAxis[]): IamTenantIamAxis['status'] =>
  tenantIamPrecedence.find((candidate) => axes.some((axis) => axis.status === candidate)) ?? 'unknown';

const resolveDominantTenantIamAxis = (
  overallStatus: IamTenantIamAxis['status'],
  axes: readonly IamTenantIamAxis[]
): IamTenantIamAxis => axes.find((axis) => axis.status === overallStatus) ?? axes[0];

const resolveTenantIamOverallSummary = (overallStatus: IamTenantIamAxis['status']): string => {
  if (overallStatus === 'ready') {
    return 'Tenant-IAM ist betriebsbereit.';
  }
  if (overallStatus === 'blocked') {
    return 'Tenant-IAM ist blockiert.';
  }
  if (overallStatus === 'degraded') {
    return 'Tenant-IAM ist eingeschränkt.';
  }
  return 'Tenant-IAM-Befund ist unvollständig.';
};

export const buildTenantIamStatus = (input: {
  keycloakStatus?: IamInstanceDetail['keycloakStatus'];
  accessEvidence?: TenantIamEvidence;
  reconcileEvidence?: TenantIamEvidence;
}): IamTenantIamStatus => {
  const configuration = buildConfigurationTenantIamAxis(input.keycloakStatus);
  const access = buildEvidenceTenantIamAxis(input.accessEvidence, {
    source: 'access_probe',
    summary: 'Noch keine tenantlokale Rechteprobe vorhanden.',
  });
  const reconcile = buildEvidenceTenantIamAxis(input.reconcileEvidence, {
    source: 'role_reconcile',
    summary: 'Noch kein Rollenabgleich ausgeführt.',
  });
  const axes = [configuration, access, reconcile] as const;
  const overallStatus = resolveTenantIamOverallStatus(axes);
  const dominantAxis = resolveDominantTenantIamAxis(overallStatus, axes);
  const overallSummary = resolveTenantIamOverallSummary(overallStatus);

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
  assignedModules: item.assignedModules,
  mainserverConfigRef: item.mainserverConfigRef,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  latestProvisioningRun,
});

export const buildAssignedModules = (
  assignedModules: readonly string[],
  contracts: ReadonlyMap<string, { permissionIds: readonly string[]; systemRoles: readonly { roleName: string }[] }>
): readonly IamInstanceAssignedModule[] =>
  assignedModules.map((moduleId) => {
    const contract = contracts.get(moduleId);
    return {
      moduleId,
      permissionIds: contract?.permissionIds ?? [],
      systemRoleNames: contract?.systemRoles.map((role) => role.roleName) ?? [],
    };
  });

export const buildModuleIamStatus = (
  assignedModules: readonly string[],
  contracts: ReadonlyMap<string, { permissionIds: readonly string[]; systemRoles: readonly { roleName: string }[] }>
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
      systemRoleNames: contract.systemRoles.map((role) => role.roleName),
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
  keycloakStatus?: KeycloakTenantStatus,
  keycloakPreflight?: IamInstanceKeycloakPreflight,
  keycloakPlan?: IamInstanceKeycloakPlan,
  keycloakProvisioningRuns: readonly IamInstanceKeycloakProvisioningRun[] = [],
  tenantIamStatus?: IamTenantIamStatus,
  moduleIamStatus?: IamInstanceDetail['moduleIamStatus']
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
  moduleIamStatus,
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
