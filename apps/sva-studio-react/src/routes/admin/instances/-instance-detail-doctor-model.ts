import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import { buildInstanceDetailCockpitModel } from './-instance-detail-cockpit';
import {
  getCockpitSourceLabel,
  mapConfigurationStatusToCockpitStatus,
} from './-instance-detail-cockpit-helpers';
import { getEffectiveTenantIamStatus } from './-instance-detail-tenant-iam';
import { getOperationsActionLabel } from './-instances-shared';

import type { DetailWorkflowAction, InstanceConfigurationAssessment } from './-instances-shared-types';
import type { IamInstanceDetail, IamTenantIamAxisStatus } from '@sva/core';
import type { OperationsPrimaryAction, RealmOperationsModel } from './-instance-detail-operations-types';

export type InstanceDoctorCheck = {
  readonly key: string;
  readonly title: string;
  readonly summary: string;
  readonly status: IamTenantIamAxisStatus;
  readonly sourceLabel: string;
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
  readonly warning:
    | {
        readonly tone: 'blocked' | 'degraded';
        readonly title: string;
        readonly summary: string;
      }
    | null;
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

const buildChecks = (
  instance: IamInstanceDetail,
  configurationAssessment: InstanceConfigurationAssessment,
): InstanceDoctorCheck[] => {
  const tenantIamStatus = getEffectiveTenantIamStatus(instance);
  const latestRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];

  const checks: InstanceDoctorCheck[] = [
    {
      key: 'configuration',
      title: t('admin.instances.doctor.checks.configuration'),
      summary: configurationAssessment.body,
      status: mapConfigurationStatusToCockpitStatus(configurationAssessment.overallStatus),
      sourceLabel: getCockpitSourceLabel(instance.keycloakStatus ? 'keycloak_status_snapshot' : 'registry'),
    },
  ];

  if (tenantIamStatus?.access) {
    checks.push({
      key: 'tenant-access',
      title: t('admin.instances.doctor.checks.tenantAccess'),
      summary: tenantIamStatus.access.summary,
      status: tenantIamStatus.access.status,
      sourceLabel: getCockpitSourceLabel(tenantIamStatus.access.source),
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
      checkedAt: tenantIamStatus.reconcile.checkedAt,
      requestId: tenantIamStatus.reconcile.requestId,
    });
  }

  if (instance.keycloakPreflight) {
    checks.push({
      key: 'preflight',
      title: t('admin.instances.doctor.checks.preflight'),
      summary:
        instance.keycloakPreflight.checks.find((check) => check.status !== 'ready')?.summary
        ?? instance.keycloakPreflight.checks[0]?.summary
        ?? t('admin.instances.flow.preflightEmpty'),
      status: mapPreflightStatus(instance.keycloakPreflight.overallStatus),
      sourceLabel: getCockpitSourceLabel('keycloak_status_snapshot'),
      checkedAt: instance.keycloakPreflight.checkedAt,
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
    });
  }

  return checks;
};

const readValidationState = (checks: readonly InstanceDoctorCheck[]): InstanceDoctorModel['validationState'] => {
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

const toDoctorAction = (action: OperationsPrimaryAction | InstanceDoctorAction): InstanceDoctorAction => ({
  action: action.action,
  label: action.label,
});

export const buildInstanceDoctorModel = ({
  instance,
  configurationAssessment,
  mutationError,
  operationsModel,
  primaryAction,
}: {
  instance: IamInstanceDetail;
  configurationAssessment: InstanceConfigurationAssessment;
  mutationError: IamHttpError | null;
  operationsModel: RealmOperationsModel;
  primaryAction: OperationsPrimaryAction;
}): InstanceDoctorModel => {
  const checks = buildChecks(instance, configurationAssessment);
  const validationState = readValidationState(checks);
  const cockpitModel = buildInstanceDetailCockpitModel(instance, mutationError);
  const firstNonReadyCheck = checks.find((check) => check.status !== 'ready');

  const recommendedAction = {
    ...toDoctorAction(primaryAction),
    summary: firstNonReadyCheck?.summary ?? cockpitModel.overallSummary,
  };

  const repairActions = dedupeActions([
    toDoctorAction(primaryAction),
    ...(instance.tenantAdminBootstrap?.username?.trim()
      ? [{ action: 'reset_tenant_admin' as const, label: getOperationsActionLabel('reset_tenant_admin') }]
      : []),
    ...(operationsModel.mode === 'new'
      ? [{ action: 'execute_provisioning' as const, label: getOperationsActionLabel('execute_provisioning') }]
      : [{ action: 'reconcileKeycloak' as const, label: getOperationsActionLabel('reconcileKeycloak') }]),
  ]);

  const validationActions = dedupeActions([
    { action: 'check_preflight' as const, label: getOperationsActionLabel('check_preflight') },
    { action: 'check_keycloak_status' as const, label: getOperationsActionLabel('check_keycloak_status') },
    { action: 'probeTenantIamAccess' as const, label: getOperationsActionLabel('probeTenantIamAccess') },
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
