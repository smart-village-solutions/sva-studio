import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import type {
  CockpitAnomalyItem,
  DetailWorkflowAction,
  InstanceConfigurationAssessment,
  InstanceDetailCockpitModel,
} from './-instances-shared-types';
import { getErrorMessage } from './-instance-error-messages';
import { getStatusGuidance } from './-instance-detail-status';
import { getEffectiveTenantIamStatus } from './-instance-detail-tenant-iam';
import {
  COCKPIT_STATUS_PRECEDENCE,
  TENANT_IAM_AXIS_LABELS,
  readPreflightCheckedAt,
  readProvisioningRunTimestamp,
  type IamInstanceDetail,
  type IamTenantIamAxisStatus,
} from './-instance-detail-shared';

type CockpitState = Pick<
  InstanceDetailCockpitModel,
  'anomalyQueue' | 'dominantEvidence' | 'overallStatus' | 'overallSummary' | 'overallTitle'
>;

export const mapConfigurationStatusToCockpitStatus = (
  status: InstanceConfigurationAssessment['overallStatus']
): IamTenantIamAxisStatus => {
  switch (status) {
    case 'complete':
      return 'ready';
    case 'degraded':
      return 'degraded';
    case 'incomplete':
      return 'blocked';
    case 'unknown':
      return 'unknown';
  }
};

export const getDetailActionLabel = (action: DetailWorkflowAction) => {
  switch (action) {
    case 'check_preflight':
      return t('admin.instances.actions.checkPreflight');
    case 'check_keycloak_status':
      return t('admin.instances.actions.checkKeycloakStatus');
    case 'plan_provisioning':
      return t('admin.instances.actions.planProvisioning');
    case 'execute_provisioning':
      return t('admin.instances.actions.executeProvisioning');
    case 'provision_admin_client':
      return t('admin.instances.actions.provisionAdminClient');
    case 'reset_tenant_admin':
      return t('admin.instances.actions.resetTenantAdmin');
    case 'activate_instance':
      return t('admin.instances.actions.activate');
    case 'rotate_client_secret':
      return t('admin.instances.actions.rotateClientSecret');
    case 'probeTenantIamAccess':
      return t('admin.instances.actions.probeTenantIamAccess');
    case 'reconcileKeycloak':
      return t('admin.instances.actions.reconcileKeycloak');
  }
};

export const getCockpitSourceLabel = (source: string) => {
  switch (source) {
    case 'access_probe':
      return t('admin.instances.cockpit.sources.accessProbe');
    case 'role_reconcile':
      return t('admin.instances.cockpit.sources.reconcile');
    case 'keycloak_status_snapshot':
      return t('admin.instances.cockpit.sources.keycloakStatus');
    case 'keycloak_provisioning_run':
      return t('admin.instances.cockpit.sources.provisioningRun');
    case 'registry':
      return t('admin.instances.cockpit.sources.registry');
    default:
      return source;
  }
};

const mapProvisioningRunStatusToCockpitStatus = (
  run: IamInstanceDetail['latestKeycloakProvisioningRun']
): IamTenantIamAxisStatus => {
  if (!run) {
    return 'unknown';
  }

  switch (run.overallStatus) {
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

const mapInstanceStatusToCockpitStatus = (status: IamInstanceDetail['status']): IamTenantIamAxisStatus => {
  switch (status) {
    case 'active':
      return 'ready';
    case 'failed':
    case 'archived':
      return 'blocked';
    case 'suspended':
    case 'provisioning':
    case 'validated':
      return 'degraded';
    case 'requested':
      return 'unknown';
  }
};

const buildMutationAnomaly = (mutationError: IamHttpError | null): CockpitAnomalyItem | null => {
  if (!mutationError) {
    return null;
  }

  return {
    key: 'mutation_error',
    title: t('admin.instances.cockpit.anomalies.diagnostics'),
    summary: getErrorMessage(mutationError),
    status:
      mutationError.code === 'keycloak_unavailable' || mutationError.code === 'database_unavailable'
        ? 'degraded'
        : 'blocked',
    sourceLabel: t('admin.instances.cockpit.sources.diagnostics'),
    ...(mutationError.requestId ? { requestId: mutationError.requestId } : {}),
  };
};

const buildTenantIamAnomalies = (
  instance: IamInstanceDetail,
  configurationAssessment: InstanceConfigurationAssessment
): CockpitAnomalyItem[] => {
  const tenantIamStatus = getEffectiveTenantIamStatus(instance);
  const anomalies: CockpitAnomalyItem[] = [];

  if (tenantIamStatus?.access.status !== 'ready') {
    anomalies.push({
      key: 'tenant-iam-access',
      title: t(TENANT_IAM_AXIS_LABELS.access),
      summary: tenantIamStatus?.access.summary ?? '',
      status: tenantIamStatus?.access.status ?? 'unknown',
      sourceLabel: getCockpitSourceLabel(tenantIamStatus?.access.source ?? 'registry'),
      ...(tenantIamStatus?.access.checkedAt ? { checkedAt: tenantIamStatus.access.checkedAt } : {}),
      ...(tenantIamStatus?.access.requestId ? { requestId: tenantIamStatus.access.requestId } : {}),
    });
  }

  if (tenantIamStatus?.reconcile.status !== 'ready') {
    anomalies.push({
      key: 'tenant-iam-reconcile',
      title: t(TENANT_IAM_AXIS_LABELS.reconcile),
      summary: tenantIamStatus?.reconcile.summary ?? '',
      status: tenantIamStatus?.reconcile.status ?? 'unknown',
      sourceLabel: getCockpitSourceLabel(tenantIamStatus?.reconcile.source ?? 'registry'),
      ...(tenantIamStatus?.reconcile.checkedAt ? { checkedAt: tenantIamStatus.reconcile.checkedAt } : {}),
      ...(tenantIamStatus?.reconcile.requestId ? { requestId: tenantIamStatus.reconcile.requestId } : {}),
    });
  }

  if (configurationAssessment.overallStatus === 'degraded' || configurationAssessment.overallStatus === 'incomplete') {
    anomalies.push({
      key: 'configuration',
      title: t(TENANT_IAM_AXIS_LABELS.configuration),
      summary: configurationAssessment.body,
      status: mapConfigurationStatusToCockpitStatus(configurationAssessment.overallStatus),
      sourceLabel: getCockpitSourceLabel(instance.keycloakStatus ? 'keycloak_status_snapshot' : 'registry'),
    });
  }

  return anomalies;
};

const buildProvisioningAnomaly = (instance: IamInstanceDetail): CockpitAnomalyItem | null => {
  const latestRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];
  if (!latestRun || latestRun.overallStatus === 'succeeded') {
    return null;
  }

  return {
    key: 'latest-run',
    title: t('admin.instances.cockpit.anomalies.provisioning'),
    summary: latestRun.driftSummary,
    status: mapProvisioningRunStatusToCockpitStatus(latestRun),
    sourceLabel: getCockpitSourceLabel('keycloak_provisioning_run'),
    ...(readProvisioningRunTimestamp(latestRun) ? { checkedAt: readProvisioningRunTimestamp(latestRun) } : {}),
    ...(latestRun.requestId ? { requestId: latestRun.requestId } : {}),
  };
};

const readOverallTitle = (status: IamTenantIamAxisStatus) => {
  switch (status) {
    case 'ready':
      return t('admin.instances.cockpit.overall.ready');
    case 'blocked':
      return t('admin.instances.cockpit.overall.blocked');
    case 'degraded':
      return t('admin.instances.cockpit.overall.degraded');
    case 'unknown':
      return t('admin.instances.cockpit.overall.unknown');
  }
};

const buildDominantEvidence = (instance: IamInstanceDetail): InstanceDetailCockpitModel['dominantEvidence'] => {
  const tenantIamStatus = getEffectiveTenantIamStatus(instance);
  const latestRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];

  if (tenantIamStatus?.overall.status !== 'ready') {
    return {
      label: t('admin.instances.cockpit.evidence.tenantIam'),
      source: tenantIamStatus?.overall.source ?? 'registry',
      sourceLabel: getCockpitSourceLabel(tenantIamStatus?.overall.source ?? 'registry'),
      checkedAt: tenantIamStatus?.overall.checkedAt,
      requestId: tenantIamStatus?.overall.requestId,
    };
  }

  if (instance.keycloakPreflight) {
    return {
      label: t('admin.instances.cockpit.evidence.preflight'),
      source: 'keycloak_status_snapshot',
      sourceLabel: getCockpitSourceLabel('keycloak_status_snapshot'),
      checkedAt: readPreflightCheckedAt(instance.keycloakPreflight),
      requestId: undefined,
    };
  }

  if (latestRun) {
    return {
      label: t('admin.instances.cockpit.evidence.provisioning'),
      source: 'keycloak_provisioning_run',
      sourceLabel: getCockpitSourceLabel('keycloak_provisioning_run'),
      checkedAt: readProvisioningRunTimestamp(latestRun),
      requestId: latestRun.requestId,
    };
  }

  return {
    label: t('admin.instances.cockpit.evidence.registry'),
    source: 'registry',
    sourceLabel: getCockpitSourceLabel('registry'),
    checkedAt: undefined,
    requestId: undefined,
  };
};

export const buildCockpitState = (
  instance: IamInstanceDetail,
  configurationAssessment: InstanceConfigurationAssessment,
  mutationError: IamHttpError | null
): CockpitState => {
  const tenantIamStatus = getEffectiveTenantIamStatus(instance);
  const latestRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];
  const anomalyQueue = buildTenantIamAnomalies(instance, configurationAssessment);
  const provisioningAnomaly = buildProvisioningAnomaly(instance);
  if (provisioningAnomaly) {
    anomalyQueue.push(provisioningAnomaly);
  }
  const mutationAnomaly = buildMutationAnomaly(mutationError);
  if (mutationAnomaly) {
    anomalyQueue.push(mutationAnomaly);
  }

  const overallStatus =
    COCKPIT_STATUS_PRECEDENCE.find((candidate) =>
      [
        tenantIamStatus?.overall.status ?? 'unknown',
        mapConfigurationStatusToCockpitStatus(configurationAssessment.overallStatus),
        mapProvisioningRunStatusToCockpitStatus(latestRun),
        mapInstanceStatusToCockpitStatus(instance.status),
        mutationAnomaly?.status ?? 'ready',
      ].includes(candidate)
    ) ?? 'unknown';

  return {
    anomalyQueue: anomalyQueue.slice(0, 3),
    dominantEvidence: buildDominantEvidence(instance),
    overallStatus,
    overallTitle: readOverallTitle(overallStatus),
    overallSummary:
      anomalyQueue[0]?.summary ?? tenantIamStatus?.overall.summary ?? getStatusGuidance(instance).body,
  };
};
