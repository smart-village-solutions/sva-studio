import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import { buildInstanceDetailCockpitModel } from './-instance-detail-cockpit';
import {
  getCockpitSourceLabel,
  mapConfigurationStatusToCockpitStatus,
} from './-instance-detail-cockpit-helpers';
import { getEffectiveTenantIamStatus } from './-instance-detail-tenant-iam';
import { getOperationsActionLabel } from './-instances-shared';

import type {
  DetailWorkflowAction,
  InstanceConfigurationAssessment,
} from './-instances-shared-types';
import type {
  IamInstanceDetail,
  IamKeycloakServiceIdentity,
  IamTenantIamAxisStatus,
  IamTenantIamEvidenceClassification,
} from '@sva/core';
import type {
  OperationsPrimaryAction,
  RealmOperationsModel,
} from './-instance-detail-operations-types';
import type { RequiredPluginReadinessAssessment } from './-instance-required-plugin-readiness';

export type InstanceDoctorCheck = {
  readonly key: string;
  readonly title: string;
  readonly summary: string;
  readonly status: IamTenantIamAxisStatus;
  readonly sourceLabel: string;
  readonly serviceIdentity?: IamKeycloakServiceIdentity;
  readonly classification?: IamTenantIamEvidenceClassification;
  readonly classificationLabel?: string;
  readonly remediation?: string;
  readonly checkedAt?: string;
  readonly requestId?: string;
};

export type InstanceDoctorAction = {
  readonly action: DetailWorkflowAction | 'focus_configuration';
  readonly label: string;
};

export type InstanceDoctorModel = {
  readonly checks: readonly InstanceDoctorCheck[];
  readonly recommendedAction: InstanceDoctorAction & { readonly summary: string };
  readonly repairActions: readonly InstanceDoctorAction[];
  readonly validationActions: readonly InstanceDoctorAction[];
  readonly validationState: 'ready' | 'blocked' | 'degraded';
  readonly warning: {
    readonly tone: 'blocked' | 'degraded';
    readonly title: string;
    readonly summary: string;
  } | null;
};

const mapPreflightStatus = (status?: string): IamTenantIamAxisStatus => {
  switch (status) {
    case 'ready':
      return 'ready';
    case 'warning':
      return 'degraded';
    case 'blocked':
      return 'blocked';
    default:
      return 'unknown';
  }
};

const mapRunStatus = (status?: string): IamTenantIamAxisStatus => {
  switch (status) {
    case 'succeeded':
      return 'ready';
    case 'failed':
      return 'blocked';
    case 'running':
    case 'planned':
      return 'degraded';
    default:
      return 'unknown';
  }
};

const dedupeActions = (actions: readonly InstanceDoctorAction[]) => {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.action)) {
      return false;
    }
    seen.add(action.action);
    return true;
  });
};

const getClassificationLabel = (
  classification: IamTenantIamEvidenceClassification | undefined
): string | undefined => {
  switch (classification) {
    case 'ready':
      return t('admin.instances.doctor.classifications.ready');
    case 'missing':
      return t('admin.instances.doctor.classifications.missing');
    case 'forbidden':
      return t('admin.instances.doctor.classifications.forbidden');
    case 'unknown':
      return t('admin.instances.doctor.classifications.unknown');
    case 'unavailable':
      return t('admin.instances.doctor.classifications.unavailable');
    case 'misconfigured':
      return t('admin.instances.doctor.classifications.misconfigured');
    default:
      return undefined;
  }
};

const getRemediation = (
  classification: IamTenantIamEvidenceClassification | undefined,
  serviceIdentity: IamKeycloakServiceIdentity | undefined
): string | undefined => {
  if (!classification || classification === 'ready') {
    return undefined;
  }
  switch (classification) {
    case 'missing':
      return t('admin.instances.doctor.remediation.missing');
    case 'forbidden':
      return t('admin.instances.doctor.remediation.forbidden');
    case 'unknown':
      return t('admin.instances.doctor.remediation.unknown');
    case 'unavailable':
      return t('admin.instances.doctor.remediation.unavailable');
    case 'misconfigured':
      return serviceIdentity === 'sva-studio-provisioner'
        ? t('admin.instances.doctor.remediation.misconfiguredProvisioner')
        : t('admin.instances.doctor.remediation.misconfiguredTenantIam');
  }
};

const getEvidencePresentation = (
  classification: IamTenantIamEvidenceClassification | undefined,
  serviceIdentity: IamKeycloakServiceIdentity | undefined
) => ({
  classification,
  classificationLabel: getClassificationLabel(classification),
  remediation: getRemediation(classification, serviceIdentity),
});

const buildChecks = (
  instance: IamInstanceDetail,
  configurationAssessment: InstanceConfigurationAssessment,
  requiredPluginReadiness: RequiredPluginReadinessAssessment | null
): InstanceDoctorCheck[] => {
  const tenantIamStatus = getEffectiveTenantIamStatus(instance);
  const latestRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];

  const checks: InstanceDoctorCheck[] = [
    {
      key: 'configuration',
      title: t('admin.instances.doctor.checks.configuration'),
      summary: configurationAssessment.body,
      status: mapConfigurationStatusToCockpitStatus(configurationAssessment.overallStatus),
      sourceLabel: getCockpitSourceLabel(
        instance.keycloakStatus ? 'keycloak_status_snapshot' : 'registry'
      ),
      serviceIdentity: tenantIamStatus?.configuration.serviceIdentity,
      ...getEvidencePresentation(
        tenantIamStatus?.configuration.classification,
        tenantIamStatus?.configuration.serviceIdentity
      ),
    },
  ];

  if (requiredPluginReadiness) {
    checks.push({
      key: 'required-plugin-readiness',
      title: t('admin.instances.pluginReadiness.title'),
      summary: requiredPluginReadiness.summary,
      status: requiredPluginReadiness.status,
      sourceLabel: t('admin.instances.pluginReadiness.title'),
    });
  }

  if (tenantIamStatus?.access) {
    checks.push({
      key: 'tenant-access',
      title: t('admin.instances.doctor.checks.tenantAccess'),
      summary: tenantIamStatus.access.summary,
      status: tenantIamStatus.access.status,
      sourceLabel: getCockpitSourceLabel(tenantIamStatus.access.source),
      serviceIdentity: tenantIamStatus.access.serviceIdentity,
      ...getEvidencePresentation(
        tenantIamStatus.access.classification,
        tenantIamStatus.access.serviceIdentity
      ),
      checkedAt: tenantIamStatus.access.checkedAt,
      requestId: tenantIamStatus.access.requestId,
    });
  }

  if (tenantIamStatus?.reconcile) {
    checks.push({
      key: 'tenant-reconcile',
      title: t('admin.instances.doctor.checks.tenantReconcile'),
      summary: tenantIamStatus.reconcile.summary,
      status: tenantIamStatus.reconcile.status,
      sourceLabel: getCockpitSourceLabel(tenantIamStatus.reconcile.source),
      serviceIdentity: tenantIamStatus.reconcile.serviceIdentity,
      ...getEvidencePresentation(
        tenantIamStatus.reconcile.classification,
        tenantIamStatus.reconcile.serviceIdentity
      ),
      checkedAt: tenantIamStatus.reconcile.checkedAt,
      requestId: tenantIamStatus.reconcile.requestId,
    });
  }

  if (instance.keycloakPreflight) {
    checks.push({
      key: 'preflight',
      title: t('admin.instances.doctor.checks.preflight'),
      summary:
        instance.keycloakPreflight.checks.find((check) => check.status !== 'ready')?.summary ??
        instance.keycloakPreflight.checks[0]?.summary ??
        t('admin.instances.flow.preflightEmpty'),
      status: mapPreflightStatus(instance.keycloakPreflight.overallStatus),
      sourceLabel: getCockpitSourceLabel('keycloak_status_snapshot'),
      checkedAt: instance.keycloakPreflight.checkedAt,
      serviceIdentity: 'sva-studio-provisioner',
    });
  }

  if (latestRun) {
    checks.push({
      key: 'latest-run',
      title: t('admin.instances.doctor.checks.latestRun'),
      summary: latestRun.driftSummary,
      status: mapRunStatus(latestRun.overallStatus),
      sourceLabel: getCockpitSourceLabel('keycloak_provisioning_run'),
      checkedAt: latestRun.updatedAt ?? latestRun.createdAt,
      requestId: latestRun.requestId ?? undefined,
      serviceIdentity: 'sva-studio-provisioner',
    });
  }

  return checks;
};

const readValidationState = (
  checks: readonly InstanceDoctorCheck[]
): InstanceDoctorModel['validationState'] => {
  if (checks.some((check) => check.status === 'blocked')) {
    return 'blocked';
  }
  if (checks.some((check) => check.status === 'degraded' || check.status === 'unknown')) {
    return 'degraded';
  }
  return 'ready';
};

const readValidationSummary = (validationState: InstanceDoctorModel['validationState']) => {
  switch (validationState) {
    case 'ready':
      return t('admin.instances.doctor.validation.ready');
    case 'blocked':
      return t('admin.instances.doctor.validation.blocked');
    case 'degraded':
      return t('admin.instances.doctor.validation.degraded');
  }
};

const toDoctorAction = (
  action: OperationsPrimaryAction | InstanceDoctorAction
): InstanceDoctorAction => ({
  action: action.action,
  label: action.label,
});

export const buildInstanceDoctorModel = ({
  instance,
  configurationAssessment,
  mutationError,
  operationsModel,
  primaryAction,
  requiredPluginReadiness = null,
}: {
  instance: IamInstanceDetail;
  configurationAssessment: InstanceConfigurationAssessment;
  mutationError: IamHttpError | null;
  operationsModel: RealmOperationsModel;
  primaryAction: OperationsPrimaryAction;
  requiredPluginReadiness?: RequiredPluginReadinessAssessment | null;
}): InstanceDoctorModel => {
  const checks = buildChecks(instance, configurationAssessment, requiredPluginReadiness);
  const validationState = readValidationState(checks);
  const cockpitModel = buildInstanceDetailCockpitModel(
    instance,
    mutationError,
    configurationAssessment,
    requiredPluginReadiness
  );
  const firstNonReadyCheck = checks.find((check) => check.status !== 'ready');

  const recommendedAction = {
    ...toDoctorAction(primaryAction),
    summary: firstNonReadyCheck?.summary ?? cockpitModel.overallSummary,
  };

  const repairActions = dedupeActions([
    toDoctorAction(primaryAction),
    ...(instance.tenantAdminBootstrap?.username?.trim()
      ? [
          {
            action: 'reset_tenant_admin' as const,
            label: getOperationsActionLabel('reset_tenant_admin'),
          },
        ]
      : []),
    ...(operationsModel.mode === 'new'
      ? [
          {
            action: 'execute_provisioning' as const,
            label: getOperationsActionLabel('execute_provisioning'),
          },
        ]
      : [
          {
            action: 'reconcileKeycloak' as const,
            label: getOperationsActionLabel('reconcileKeycloak'),
          },
        ]),
  ]);

  const validationActions = dedupeActions([
    { action: 'check_preflight' as const, label: getOperationsActionLabel('check_preflight') },
    {
      action: 'check_keycloak_status' as const,
      label: getOperationsActionLabel('check_keycloak_status'),
    },
    {
      action: 'probeTenantIamAccess' as const,
      label: getOperationsActionLabel('probeTenantIamAccess'),
    },
  ]);

  return {
    checks,
    recommendedAction,
    repairActions,
    validationActions,
    validationState,
    warning:
      validationState === 'ready'
        ? null
        : {
            tone: validationState,
            title: t('admin.instances.doctor.warning.title'),
            summary: readValidationSummary(validationState),
          },
  };
};
