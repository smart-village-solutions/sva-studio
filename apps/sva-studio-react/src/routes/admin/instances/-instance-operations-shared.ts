import {
  areAllInstanceKeycloakRequirementsSatisfied,
  isInstanceTenantAdminRequired,
  type IamInstanceDetail,
} from '@sva/core';
import { t } from '../../../i18n';
import { findPreflightCheck } from './-instance-detail-shared';
import type {
  EvidenceSource,
  OperationsDetailAction,
  OperationsStepKey,
  OperationsStepModel,
  RealmOperationsModel,
} from './-instance-detail-operations-types';

export const NEW_REALM_STEP_TITLES: Record<
  Exclude<
    OperationsStepKey,
    'live_status' | 'drift_analysis' | 'contract_repair' | 'reconcile' | 'result_validation'
  >,
  string
> = {
  registry_contract: 'admin.instances.operations.new.steps.registryContract',
  worker_preflight: 'admin.instances.operations.new.steps.workerPreflight',
  worker_plan: 'admin.instances.operations.new.steps.workerPlan',
  realm: 'admin.instances.operations.new.steps.realm',
  login_client: 'admin.instances.operations.new.steps.loginClient',
  tenant_admin_client: 'admin.instances.operations.new.steps.tenantAdminClient',
  realm_roles: 'admin.instances.operations.new.steps.realmRoles',
  tenant_admin: 'admin.instances.operations.new.steps.tenantAdmin',
  secret_sync: 'admin.instances.operations.new.steps.secretSync',
  final_validation: 'admin.instances.operations.new.steps.finalValidation',
  realm_bootstrap_complete: 'admin.instances.operations.new.steps.realmBootstrapComplete',
};

export const EXISTING_REALM_STEP_TITLES: Record<
  Extract<
    OperationsStepKey,
    | 'registry_contract'
    | 'worker_preflight'
    | 'live_status'
    | 'drift_analysis'
    | 'contract_repair'
    | 'reconcile'
    | 'result_validation'
  >,
  string
> = {
  registry_contract: 'admin.instances.operations.existing.steps.registryContract',
  worker_preflight: 'admin.instances.operations.existing.steps.workerPreflight',
  live_status: 'admin.instances.operations.existing.steps.liveStatus',
  drift_analysis: 'admin.instances.operations.existing.steps.driftAnalysis',
  contract_repair: 'admin.instances.operations.existing.steps.contractRepair',
  reconcile: 'admin.instances.operations.existing.steps.reconcile',
  result_validation: 'admin.instances.operations.existing.steps.resultValidation',
};

const WORKER_PREFLIGHT_COPY = {
  new: {
    title: NEW_REALM_STEP_TITLES.worker_preflight,
    summary: {
      offen: 'admin.instances.operations.new.stepSummaries.workerPreflightPending',
      fehlgeschlagen: 'admin.instances.operations.new.stepSummaries.workerPreflightFailed',
      erfolgreich: 'admin.instances.operations.new.stepSummaries.workerPreflightReady',
      bereit: 'admin.instances.operations.new.stepSummaries.workerPreflightReadyToRun',
    },
  },
  existing: {
    title: EXISTING_REALM_STEP_TITLES.worker_preflight,
    summary: {
      offen: 'admin.instances.operations.existing.stepSummaries.workerPreflightPending',
      fehlgeschlagen: 'admin.instances.operations.existing.stepSummaries.workerPreflightFailed',
      erfolgreich: 'admin.instances.operations.existing.stepSummaries.workerPreflightReady',
      bereit: 'admin.instances.operations.existing.stepSummaries.workerPreflightReadyToRun',
    },
  },
} as const;

export type WorkerPreflightStatus = keyof (typeof WORKER_PREFLIGHT_COPY)['new']['summary'];

export const readLatestKeycloakRun = (instance: IamInstanceDetail) =>
  instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];

export const readProvisioningRunState = (
  run: IamInstanceDetail['latestKeycloakProvisioningRun']
) => ({
  hasRun: Boolean(run),
  failed: run?.overallStatus === 'failed',
  running: run?.overallStatus === 'running',
  planned: run?.overallStatus === 'planned',
  succeeded: run?.overallStatus === 'succeeded',
});

export const readPreflightTimestamp = (preflight: IamInstanceDetail['keycloakPreflight']) =>
  preflight?.checkedAt;

export const readRunTimestamp = (run: IamInstanceDetail['latestKeycloakProvisioningRun']) =>
  run?.updatedAt ?? run?.createdAt;

export const isRegistryContractComplete = (instance: IamInstanceDetail) =>
  Boolean(
    instance.displayName.trim() &&
    instance.parentDomain.trim() &&
    instance.authRealm.trim() &&
    instance.authClientId.trim() &&
    instance.tenantAdminClient?.clientId?.trim() &&
    instance.tenantAdminBootstrap?.username?.trim()
  );

export const createOperationStep = (input: OperationsStepModel): OperationsStepModel => input;

export const isNewRealmProvisioningStep = (stepKey: OperationsStepKey) =>
  [
    'realm',
    'login_client',
    'tenant_admin_client',
    'realm_roles',
    'tenant_admin',
    'secret_sync',
  ].includes(stepKey);

export const getOperationsActionLabel = (action: OperationsDetailAction): string => {
  switch (action) {
    case 'focus_configuration':
      return t('admin.instances.actions.openConfiguration');
    case 'check_preflight':
      return t('admin.instances.actions.checkPreflight');
    case 'refresh_readiness':
      return t('admin.instances.actions.refreshReadiness');
    case 'open_diagnostics':
      return t('admin.instances.actions.openDiagnostics');
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
    case 'retry_tenant_provisioning':
      return t('admin.instances.feedback.provisioningRetryAction');
    case 'rotate_client_secret':
      return t('admin.instances.actions.rotateClientSecret');
    case 'probeTenantIamAccess':
      return t('admin.instances.actions.probeTenantIamAccess');
    case 'reconcileKeycloak':
      return t('admin.instances.actions.reconcileKeycloak');
    case 'reconcileTenantIamRoles':
      return t('admin.instances.actions.reconcileTenantIamRoles');
  }
};

export const getOperationsEvidenceSourceLabel = (source: EvidenceSource): string => {
  switch (source) {
    case 'registry_contract':
      return t('admin.instances.operations.labels.evidenceSources.registryContract');
    case 'worker_preflight':
      return t('admin.instances.operations.labels.evidenceSources.workerPreflight');
    case 'worker_plan':
      return t('admin.instances.operations.labels.evidenceSources.workerPlan');
    case 'keycloak_run':
      return t('admin.instances.operations.labels.evidenceSources.keycloakRun');
    case 'final_validation':
      return t('admin.instances.operations.labels.evidenceSources.finalValidation');
    case 'history':
      return t('admin.instances.operations.labels.evidenceSources.history');
  }
};

export const isFinalKeycloakStateSatisfied = (instance: IamInstanceDetail) =>
  Boolean(
    instance.keycloakStatus &&
    areAllInstanceKeycloakRequirementsSatisfied(instance.keycloakStatus, {
      requireTenantAdmin: isInstanceTenantAdminRequired(instance),
    })
  );

export const deriveOperationsModelStatus = (
  steps: OperationsStepModel[]
): RealmOperationsModel['status'] => {
  if (steps.some((step) => step.status === 'fehlgeschlagen')) {
    return 'blocked';
  }

  if (steps.some((step) => step.status === 'läuft' || step.status === 'bereit')) {
    return 'degraded';
  }

  if (steps.every((step) => step.status === 'erfolgreich')) {
    return 'ready';
  }

  return 'unknown';
};

const readWorkerPreflightStatus = (
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight']
): WorkerPreflightStatus => {
  if (!contractComplete) {
    return 'offen';
  }
  if (preflight?.overallStatus === 'blocked') {
    return 'fehlgeschlagen';
  }
  return preflight ? 'erfolgreich' : 'bereit';
};

const readWorkerPreflightSummary = (
  mode: 'new' | 'existing',
  status: WorkerPreflightStatus,
  preflight: IamInstanceDetail['keycloakPreflight']
) => {
  const copy = WORKER_PREFLIGHT_COPY[mode];
  if (mode === 'new' && status === 'fehlgeschlagen') {
    return findPreflightCheck(preflight, 'realm_mode')?.summary ?? t(copy.summary.fehlgeschlagen);
  }
  return t(copy.summary[status]);
};

export const buildWorkerPreflightStep = (
  mode: 'new' | 'existing',
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight']
): OperationsStepModel => {
  const status = readWorkerPreflightStatus(contractComplete, preflight);
  const copy = WORKER_PREFLIGHT_COPY[mode];

  return createOperationStep({
    key: 'worker_preflight',
    title: t(copy.title),
    status,
    summary: readWorkerPreflightSummary(mode, status, preflight),
    evidenceSource: 'worker_preflight',
    checkedAt: readPreflightTimestamp(preflight),
    action: status === 'bereit' ? 'check_preflight' : undefined,
  });
};
