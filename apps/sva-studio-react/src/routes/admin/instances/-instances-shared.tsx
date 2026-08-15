import {
  areAllInstanceKeycloakRequirementsSatisfied,
  type IamInstanceDetail,
} from '@sva/core';

import { Badge } from '../../../components/ui/badge';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import type {
  EvidenceSource,
  HistoryWorkspaceModel,
  OperationsDetailAction,
  OperationsPrimaryAction,
  OperationsStepKey,
  OperationsStepModel,
  RealmOperationsModel,
} from './-instance-detail-operations-types';
import { getInstanceErrorMessage } from './-instance-error-message-shared';
import { findPreflightCheck } from './-instance-detail-shared';

export type {
  CockpitAnomalyItem,
  CreateFormValues,
  CreateWizardStepKey,
  DetailFormValues,
  DetailWorkflowAction,
  InstanceConfigurationAssessment,
  InstanceConfigurationIssue,
  InstanceConfigurationOverallStatus,
  InstanceDetailCockpitModel,
  InstanceFieldHelpKey,
  PrimaryDetailAction,
  SelectedInstance,
  SetupWorkflowStep,
  WorkflowStepState,
} from './-instances-shared-types';
export type {
  DetailNavigationAction,
  EvidenceSource,
  HistoryWorkspaceModel,
  NextActionReason,
  OperationStepStatus,
  OperationsDetailAction,
  OperationsPrimaryAction,
  OperationsStepKey,
  OperationsStepModel,
  RealmOperationsMode,
  RealmOperationsModel,
} from './-instance-detail-operations-types';

export const getErrorMessage = getInstanceErrorMessage;

const NEW_REALM_STEP_TITLES: Record<
  Exclude<OperationsStepKey, 'live_status' | 'drift_analysis' | 'contract_repair' | 'reconcile' | 'result_validation'>,
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

const EXISTING_REALM_STEP_TITLES: Record<
  Extract<OperationsStepKey, 'registry_contract' | 'worker_preflight' | 'live_status' | 'drift_analysis' | 'contract_repair' | 'reconcile' | 'result_validation'>,
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

type WorkerPreflightStatus = keyof (typeof WORKER_PREFLIGHT_COPY)['new']['summary'];

const readLatestKeycloakRun = (instance: IamInstanceDetail) =>
  instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];

const readProvisioningRunState = (run: IamInstanceDetail['latestKeycloakProvisioningRun']) => ({
  hasRun: Boolean(run),
  failed: run?.overallStatus === 'failed',
  running: run?.overallStatus === 'running',
  planned: run?.overallStatus === 'planned',
  succeeded: run?.overallStatus === 'succeeded',
});

const readPreflightTimestamp = (preflight: IamInstanceDetail['keycloakPreflight']) => preflight?.checkedAt;

const readRunTimestamp = (run: IamInstanceDetail['latestKeycloakProvisioningRun']) =>
  run?.updatedAt ?? run?.createdAt;

const isRegistryContractComplete = (instance: IamInstanceDetail) =>
  Boolean(
    instance.displayName.trim()
    && instance.parentDomain.trim()
    && instance.authRealm.trim()
    && instance.authClientId.trim()
    && instance.tenantAdminClient?.clientId?.trim()
    && instance.tenantAdminBootstrap?.username?.trim()
  );

const createOperationStep = (input: OperationsStepModel): OperationsStepModel => input;

const isNewRealmProvisioningStep = (stepKey: OperationsStepKey) =>
  ['realm', 'login_client', 'tenant_admin_client', 'realm_roles', 'tenant_admin', 'secret_sync'].includes(stepKey);

export const getOperationsActionLabel = (action: OperationsDetailAction): string => {
  switch (action) {
    case 'focus_configuration':
      return t('admin.instances.actions.openConfiguration');
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

const isFinalKeycloakStateSatisfied = (instance: IamInstanceDetail) =>
  Boolean(instance.keycloakStatus && areAllInstanceKeycloakRequirementsSatisfied(instance.keycloakStatus));

const deriveOperationsModelStatus = (steps: OperationsStepModel[]): RealmOperationsModel['status'] => {
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

const buildWorkerPreflightStep = (
  mode: 'new' | 'existing',
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
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

const buildNewRealmRegistryContractStep = (
  instance: IamInstanceDetail,
  contractComplete: boolean
): OperationsStepModel =>
  createOperationStep({
    key: 'registry_contract',
    title: t(NEW_REALM_STEP_TITLES.registry_contract),
    status: contractComplete ? 'erfolgreich' : 'fehlgeschlagen',
    summary: contractComplete
      ? t('admin.instances.operations.new.stepSummaries.registryContractReady')
      : t('admin.instances.operations.new.stepSummaries.registryContractFailed'),
    evidenceSource: 'registry_contract',
    checkedAt: instance.updatedAt,
    action: contractComplete ? undefined : 'focus_configuration',
  });

const readNewRealmWorkerPlanState = (
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
  plan: IamInstanceDetail['keycloakPlan']
): Pick<OperationsStepModel, 'status' | 'summary' | 'action'> => {
  const action = readNewRealmWorkerPlanAction(contractComplete, preflight, plan);
  if (!contractComplete) {
    return {
      status: 'offen',
      summary: t('admin.instances.operations.new.stepSummaries.workerPlanPending'),
      action,
    };
  }
  if (preflight?.overallStatus === 'blocked') {
    return {
      status: 'offen',
      summary: t('admin.instances.operations.new.stepSummaries.workerPlanPending'),
      action,
    };
  }
  if (plan?.overallStatus === 'blocked') {
    return { status: 'fehlgeschlagen', summary: plan.driftSummary, action };
  }
  if (plan) {
    return {
      status: 'erfolgreich',
      summary: t('admin.instances.operations.new.stepSummaries.workerPlanReady'),
      action,
    };
  }
  return {
    status: 'bereit',
    summary: t('admin.instances.operations.new.stepSummaries.workerPlanReadyToRun'),
    action,
  };
};

function readNewRealmWorkerPlanAction(
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
  plan: IamInstanceDetail['keycloakPlan']
): OperationsStepModel['action'] {
  if (!contractComplete || !preflight) {
    return undefined;
  }
  return plan ? undefined : 'plan_provisioning';
}

const buildNewRealmWorkerPlanStep = (
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
  plan: IamInstanceDetail['keycloakPlan']
): OperationsStepModel =>
  createOperationStep({
    key: 'worker_plan',
    title: t(NEW_REALM_STEP_TITLES.worker_plan),
    evidenceSource: 'worker_plan',
    checkedAt: plan?.generatedAt,
    ...readNewRealmWorkerPlanState(contractComplete, preflight, plan),
  });

const buildNewRealmLeadSteps = (
  instance: IamInstanceDetail,
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
  plan: IamInstanceDetail['keycloakPlan'],
): OperationsStepModel[] => [
  buildNewRealmRegistryContractStep(instance, contractComplete),
  buildWorkerPreflightStep('new', contractComplete, preflight),
  buildNewRealmWorkerPlanStep(contractComplete, preflight, plan),
];

const buildNewRealmOperationsSummary = (
  instance: IamInstanceDetail,
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
  runState: ReturnType<typeof readProvisioningRunState>,
  realmModeBlocked: boolean,
): string => {
  if (!contractComplete) {
    return t('admin.instances.operations.new.summary.contractIncomplete');
  }

  if (realmModeBlocked) {
    return t('admin.instances.operations.new.summary.modeConflict');
  }

  if (preflight?.overallStatus === 'blocked') {
    return t('admin.instances.operations.new.summary.preflightBlocked');
  }

  if (runState.failed) {
    return t('admin.instances.operations.new.summary.runFailed');
  }

  return isFinalKeycloakStateSatisfied(instance)
    ? t('admin.instances.operations.new.summary.bootstrapComplete')
    : t('admin.instances.operations.new.summary.inProgress');
};

const buildNewRealmFollowUpActions = (
  instance: IamInstanceDetail,
): RealmOperationsModel['followUpActions'] =>
  instance.status !== 'active' && isFinalKeycloakStateSatisfied(instance)
    ? ['activate_instance']
    : [];

type NewRealmArtifactContext = {
  instance: IamInstanceDetail;
  latestRun: IamInstanceDetail['latestKeycloakProvisioningRun'];
  runState: ReturnType<typeof readProvisioningRunState>;
};

const readNewRealmArtifactState = (
  satisfied: boolean,
  runState: ReturnType<typeof readProvisioningRunState>,
  failedSummaryKey: string,
  readySummaryKey: string,
): Pick<OperationsStepModel, 'status' | 'summary'> => {
  if (satisfied) {
    return { status: 'erfolgreich', summary: t(readySummaryKey) };
  }
  if (runState.failed || runState.succeeded) {
    return { status: 'fehlgeschlagen', summary: t(failedSummaryKey) };
  }
  if (runState.running || runState.planned) {
    return {
      status: 'läuft',
      summary: t('admin.instances.operations.new.stepSummaries.awaitingCurrentRun'),
    };
  }
  return {
    status: 'offen',
    summary: t('admin.instances.operations.new.stepSummaries.pendingWorkerExecution'),
  };
};

const buildNewRealmRealmStep = ({
  instance,
  latestRun,
  runState,
}: NewRealmArtifactContext): OperationsStepModel => createOperationStep({
  key: 'realm',
  title: t(NEW_REALM_STEP_TITLES.realm),
  evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
  checkedAt: readRunTimestamp(latestRun),
  requestId: latestRun?.requestId,
  ...readNewRealmArtifactState(
    Boolean(instance.keycloakStatus?.realmExists),
    runState,
    'admin.instances.operations.new.stepSummaries.realmFailed',
    'admin.instances.operations.new.stepSummaries.realmReady',
  ),
});

const buildNewRealmLoginClientStep = ({
  instance,
  latestRun,
  runState,
}: NewRealmArtifactContext): OperationsStepModel => createOperationStep({
  key: 'login_client',
  title: t(NEW_REALM_STEP_TITLES.login_client),
  evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
  checkedAt: readRunTimestamp(latestRun),
  requestId: latestRun?.requestId,
  ...readNewRealmArtifactState(
    Boolean(
      instance.keycloakStatus?.clientExists
        && instance.keycloakStatus.redirectUrisMatch
        && instance.keycloakStatus.logoutUrisMatch
        && instance.keycloakStatus.webOriginsMatch
    ),
    runState,
    'admin.instances.operations.new.stepSummaries.loginClientFailed',
    'admin.instances.operations.new.stepSummaries.loginClientReady',
  ),
});

const buildNewRealmTenantAdminClientStep = ({
  instance,
  latestRun,
  runState,
}: NewRealmArtifactContext): OperationsStepModel => createOperationStep({
  key: 'tenant_admin_client',
  title: t(NEW_REALM_STEP_TITLES.tenant_admin_client),
  evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
  checkedAt: readRunTimestamp(latestRun),
  requestId: latestRun?.requestId,
  ...readNewRealmArtifactState(
    Boolean(instance.keycloakStatus?.tenantAdminClientExists),
    runState,
    'admin.instances.operations.new.stepSummaries.tenantAdminClientFailed',
    'admin.instances.operations.new.stepSummaries.tenantAdminClientReady',
  ),
});

const buildNewRealmRolesStep = ({
  instance,
  latestRun,
  runState,
}: NewRealmArtifactContext): OperationsStepModel => createOperationStep({
  key: 'realm_roles',
  title: t(NEW_REALM_STEP_TITLES.realm_roles),
  evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
  checkedAt: readRunTimestamp(latestRun),
  requestId: latestRun?.requestId,
  ...readNewRealmArtifactState(
    Boolean(instance.keycloakStatus?.tenantAdminHasSystemAdmin),
    runState,
    'admin.instances.operations.new.stepSummaries.realmRolesFailed',
    'admin.instances.operations.new.stepSummaries.realmRolesReady',
  ),
});

const buildNewRealmTenantAdminStep = ({
  instance,
  latestRun,
  runState,
}: NewRealmArtifactContext): OperationsStepModel => createOperationStep({
  key: 'tenant_admin',
  title: t(NEW_REALM_STEP_TITLES.tenant_admin),
  evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
  checkedAt: readRunTimestamp(latestRun),
  requestId: latestRun?.requestId,
  ...readNewRealmArtifactState(
    Boolean(instance.keycloakStatus?.tenantAdminExists),
    runState,
    'admin.instances.operations.new.stepSummaries.tenantAdminFailed',
    'admin.instances.operations.new.stepSummaries.tenantAdminReady',
  ),
});

const buildNewRealmSecretSyncStep = ({
  instance,
  latestRun,
  runState,
}: NewRealmArtifactContext): OperationsStepModel => createOperationStep({
  key: 'secret_sync',
  title: t(NEW_REALM_STEP_TITLES.secret_sync),
  evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
  checkedAt: readRunTimestamp(latestRun),
  requestId: latestRun?.requestId,
  ...readNewRealmArtifactState(
    Boolean(
      instance.keycloakStatus?.clientSecretAligned
        && instance.keycloakStatus.tenantAdminClientSecretAligned
    ),
    runState,
    'admin.instances.operations.new.stepSummaries.secretSyncFailed',
    'admin.instances.operations.new.stepSummaries.secretSyncReady',
  ),
});

const readNewRealmFinalValidationStatus = (
  instance: IamInstanceDetail,
  runState: ReturnType<typeof readProvisioningRunState>,
): OperationsStepModel['status'] => {
  if (isFinalKeycloakStateSatisfied(instance)) {
    return 'erfolgreich';
  }
  if (runState.failed || runState.succeeded) {
    return 'fehlgeschlagen';
  }
  return runState.running || runState.planned ? 'läuft' : 'offen';
};

const buildNewRealmFinalValidationStep = (
  instance: IamInstanceDetail,
  runState: ReturnType<typeof readProvisioningRunState>,
  requestId: string | undefined,
): OperationsStepModel => {
  const status = readNewRealmFinalValidationStatus(instance, runState);
  return createOperationStep({
    key: 'final_validation',
    title: t(NEW_REALM_STEP_TITLES.final_validation),
    evidenceSource: 'final_validation',
    checkedAt: instance.updatedAt,
    requestId,
    status,
    summary: status === 'erfolgreich'
      ? t('admin.instances.operations.new.stepSummaries.finalValidationReady')
      : status === 'fehlgeschlagen'
        ? t('admin.instances.operations.new.stepSummaries.finalValidationFailed')
        : t('admin.instances.operations.new.stepSummaries.finalValidationPending'),
  });
};

const buildNewRealmBootstrapCompleteStep = (
  instance: IamInstanceDetail,
  requestId: string | undefined,
): OperationsStepModel => {
  const complete = isFinalKeycloakStateSatisfied(instance);
  return createOperationStep({
    key: 'realm_bootstrap_complete',
    title: t(NEW_REALM_STEP_TITLES.realm_bootstrap_complete),
    evidenceSource: 'final_validation',
    checkedAt: instance.updatedAt,
    requestId,
    status: complete ? 'erfolgreich' : 'offen',
    summary: complete
      ? t('admin.instances.operations.new.stepSummaries.bootstrapCompleteReady')
      : t('admin.instances.operations.new.stepSummaries.bootstrapCompletePending'),
  });
};

const buildNewRealmArtifactSteps = (instance: IamInstanceDetail): OperationsStepModel[] => {
  const latestRun = readLatestKeycloakRun(instance);
  const runState = readProvisioningRunState(latestRun);
  const context = { instance, latestRun, runState };
  const requestId = latestRun?.requestId;
  return [
    buildNewRealmRealmStep(context),
    buildNewRealmLoginClientStep(context),
    buildNewRealmTenantAdminClientStep(context),
    buildNewRealmRolesStep(context),
    buildNewRealmTenantAdminStep(context),
    buildNewRealmSecretSyncStep(context),
    buildNewRealmFinalValidationStep(instance, runState, requestId),
    buildNewRealmBootstrapCompleteStep(instance, requestId),
  ];
};

export const buildNewRealmOperationsModel = (
  instance: IamInstanceDetail,
  _mutationError: IamHttpError | null,
): RealmOperationsModel => {
  const contractComplete = isRegistryContractComplete(instance);
  const preflight = instance.keycloakPreflight;
  const plan = instance.keycloakPlan;
  const latestRun = readLatestKeycloakRun(instance);
  const runState = readProvisioningRunState(latestRun);
  const realmModeBlocked = findPreflightCheck(preflight, 'realm_mode')?.status === 'blocked';
  const steps: OperationsStepModel[] = buildNewRealmLeadSteps(instance, contractComplete, preflight, plan);

  steps.push(...buildNewRealmArtifactSteps(instance));

  return {
    mode: 'new',
    status: deriveOperationsModelStatus(steps),
    summary: buildNewRealmOperationsSummary(instance, contractComplete, preflight, runState, realmModeBlocked),
    steps,
    followUpActions: buildNewRealmFollowUpActions(instance),
    signals: {
      modeConflict: realmModeBlocked,
      hasDrift: false,
    },
  };
};

const buildExistingRealmAssessmentSteps = (
  instance: IamInstanceDetail,
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
  latestRun: IamInstanceDetail['latestKeycloakProvisioningRun'],
  hasDrift: boolean,
): OperationsStepModel[] => [
  buildExistingRealmRegistryContractStep(instance, contractComplete),
  buildWorkerPreflightStep('existing', contractComplete, preflight),
  buildExistingRealmLiveStatusStep(instance, preflight),
  buildExistingRealmDriftAnalysisStep(instance, hasDrift),
  buildExistingRealmContractRepairStep(instance, contractComplete),
  buildExistingRealmReconcileStep(instance, latestRun, hasDrift),
  buildExistingRealmResultValidationStep(instance, hasDrift),
];

function buildExistingRealmRegistryContractStep(
  instance: IamInstanceDetail,
  contractComplete: boolean
): OperationsStepModel {
  return createOperationStep({
    key: 'registry_contract',
    title: t(EXISTING_REALM_STEP_TITLES.registry_contract),
    status: contractComplete ? 'erfolgreich' : 'fehlgeschlagen',
    summary: contractComplete
      ? t('admin.instances.operations.existing.stepSummaries.registryContractReady')
      : t('admin.instances.operations.existing.stepSummaries.registryContractFailed'),
    evidenceSource: 'registry_contract',
    checkedAt: instance.updatedAt,
    action: contractComplete ? undefined : 'focus_configuration',
  });
}

function buildExistingRealmLiveStatusStep(
  instance: IamInstanceDetail,
  preflight: IamInstanceDetail['keycloakPreflight']
): OperationsStepModel {
  const liveStatusAvailable = Boolean(instance.keycloakStatus);
  return createOperationStep({
    key: 'live_status',
    title: t(EXISTING_REALM_STEP_TITLES.live_status),
    status: liveStatusAvailable
      ? 'erfolgreich'
      : preflight?.overallStatus === 'blocked'
        ? 'offen'
        : 'bereit',
    summary: liveStatusAvailable
      ? t('admin.instances.operations.existing.stepSummaries.liveStatusReady')
      : t('admin.instances.operations.existing.stepSummaries.liveStatusPending'),
    evidenceSource: liveStatusAvailable ? 'final_validation' : 'worker_preflight',
    checkedAt: instance.updatedAt,
    action: liveStatusAvailable ? undefined : 'check_keycloak_status',
  });
}

function buildExistingRealmDriftAnalysisStep(
  instance: IamInstanceDetail,
  hasDrift: boolean
): OperationsStepModel {
  const liveStatusAvailable = Boolean(instance.keycloakStatus);
  return createOperationStep({
    key: 'drift_analysis',
    title: t(EXISTING_REALM_STEP_TITLES.drift_analysis),
    status: !liveStatusAvailable
      ? 'offen'
      : hasDrift
        ? 'fehlgeschlagen'
        : 'erfolgreich',
    summary: !liveStatusAvailable
      ? t('admin.instances.operations.existing.stepSummaries.driftAnalysisPending')
      : hasDrift
        ? t('admin.instances.operations.existing.stepSummaries.driftAnalysisFailed')
        : t('admin.instances.operations.existing.stepSummaries.driftAnalysisReady'),
    evidenceSource: liveStatusAvailable ? 'final_validation' : 'history',
    checkedAt: instance.updatedAt,
  });
}

function buildExistingRealmContractRepairStep(
  instance: IamInstanceDetail,
  contractComplete: boolean
): OperationsStepModel {
  return createOperationStep({
    key: 'contract_repair',
    title: t(EXISTING_REALM_STEP_TITLES.contract_repair),
    status: contractComplete ? 'erfolgreich' : 'fehlgeschlagen',
    summary: contractComplete
      ? t('admin.instances.operations.existing.stepSummaries.contractRepairReady')
      : t('admin.instances.operations.existing.stepSummaries.contractRepairFailed'),
    evidenceSource: 'registry_contract',
    checkedAt: instance.updatedAt,
    action: contractComplete ? undefined : 'focus_configuration',
  });
}

function buildExistingRealmReconcileStep(
  instance: IamInstanceDetail,
  latestRun: IamInstanceDetail['latestKeycloakProvisioningRun'],
  hasDrift: boolean
): OperationsStepModel {
  const liveStatusAvailable = Boolean(instance.keycloakStatus);
  const latestRunFailed = latestRun?.overallStatus === 'failed';
  return createOperationStep({
    key: 'reconcile',
    title: t(EXISTING_REALM_STEP_TITLES.reconcile),
    ...readExistingRealmReconcileState(liveStatusAvailable, latestRunFailed, hasDrift),
    evidenceSource: latestRun ? 'keycloak_run' : 'final_validation',
    checkedAt: readRunTimestamp(latestRun) ?? instance.updatedAt,
    requestId: latestRun?.requestId,
    action: liveStatusAvailable && hasDrift ? 'reconcileKeycloak' : undefined,
  });
}

function readExistingRealmReconcileState(
  liveStatusAvailable: boolean,
  latestRunFailed: boolean,
  hasDrift: boolean
): Pick<OperationsStepModel, 'status' | 'summary'> {
  if (!liveStatusAvailable) {
    return {
      status: 'offen',
      summary: t('admin.instances.operations.existing.stepSummaries.reconcilePending'),
    };
  }
  if (latestRunFailed) {
    return {
      status: 'fehlgeschlagen',
      summary: t('admin.instances.operations.existing.stepSummaries.reconcileFailed'),
    };
  }
  if (hasDrift) {
    return {
      status: 'bereit',
      summary: t('admin.instances.operations.existing.stepSummaries.reconcileReadyToRun'),
    };
  }
  return {
    status: 'erfolgreich',
    summary: t('admin.instances.operations.existing.stepSummaries.reconcileReady'),
  };
}

function buildExistingRealmResultValidationStep(
  instance: IamInstanceDetail,
  hasDrift: boolean
): OperationsStepModel {
  const liveStatusAvailable = Boolean(instance.keycloakStatus);
  return createOperationStep({
    key: 'result_validation',
    title: t(EXISTING_REALM_STEP_TITLES.result_validation),
    status: !liveStatusAvailable
      ? 'offen'
      : hasDrift
        ? 'fehlgeschlagen'
        : 'erfolgreich',
    summary: !liveStatusAvailable
      ? t('admin.instances.operations.existing.stepSummaries.resultValidationPending')
      : hasDrift
        ? t('admin.instances.operations.existing.stepSummaries.resultValidationFailed')
        : t('admin.instances.operations.existing.stepSummaries.resultValidationReady'),
    evidenceSource: 'final_validation',
    checkedAt: instance.updatedAt,
  });
}

export const buildExistingRealmOperationsModel = (
  instance: IamInstanceDetail,
  _mutationError: IamHttpError | null,
): RealmOperationsModel => {
  const contractComplete = Boolean(
    instance.displayName.trim()
    && instance.parentDomain.trim()
    && instance.authRealm.trim()
    && instance.authClientId.trim()
    && instance.authClientSecretConfigured
    && instance.tenantAdminClient?.clientId?.trim()
  );
  const preflight = instance.keycloakPreflight;
  const latestRun = readLatestKeycloakRun(instance);
  const hasDrift = Boolean(instance.keycloakStatus && !areAllInstanceKeycloakRequirementsSatisfied(instance.keycloakStatus));
  const steps = buildExistingRealmAssessmentSteps(instance, contractComplete, preflight, latestRun, hasDrift);

  return {
    mode: 'existing',
    status: deriveOperationsModelStatus(steps),
    summary: hasDrift
      ? t('admin.instances.operations.existing.summary.driftDetected')
      : t('admin.instances.operations.existing.summary.reconcileReady'),
    steps,
    followUpActions: [],
    signals: {
      modeConflict: false,
      hasDrift,
    },
  };
};

const createOperationsPrimaryAction = (
  action: OperationsPrimaryAction['action'],
  reason: OperationsPrimaryAction['reason']
): OperationsPrimaryAction => ({
  action,
  label: getOperationsActionLabel(action),
  reason,
});

const findOperationsStep = (model: RealmOperationsModel, key: OperationsStepKey) =>
  model.steps.find((step) => step.key === key);

const buildNewRealmPrerequisiteAction = (
  model: RealmOperationsModel
): OperationsPrimaryAction | undefined => {
  if (findOperationsStep(model, 'registry_contract')?.status === 'fehlgeschlagen') {
    return createOperationsPrimaryAction('focus_configuration', 'missing_contract');
  }
  if (model.signals.modeConflict) {
    return createOperationsPrimaryAction('check_preflight', 'mode_conflict');
  }
  if (findOperationsStep(model, 'worker_preflight')?.status === 'fehlgeschlagen') {
    return createOperationsPrimaryAction('check_preflight', 'preflight_blocked');
  }
  return undefined;
};

const buildCompletedNewRealmFollowUpAction = (
  model: RealmOperationsModel
): OperationsPrimaryAction | undefined => {
  const followUpAction = model.followUpActions[0];
  return findOperationsStep(model, 'final_validation')?.status === 'erfolgreich' && followUpAction
    ? createOperationsPrimaryAction(followUpAction, 'follow_up')
    : undefined;
};

const buildNewRealmWorkerAction = (
  model: RealmOperationsModel
): OperationsPrimaryAction | undefined => {
  const workerPlanStatus = findOperationsStep(model, 'worker_plan')?.status;
  if (workerPlanStatus === 'bereit' || workerPlanStatus === 'fehlgeschlagen') {
    return createOperationsPrimaryAction('plan_provisioning', 'follow_up');
  }
  const failedArtifact = model.steps.find((step) =>
    isNewRealmProvisioningStep(step.key) && step.status === 'fehlgeschlagen'
  );
  if (failedArtifact) {
    return createOperationsPrimaryAction('execute_provisioning', 'run_retry');
  }
  const pendingArtifact = model.steps.find((step) =>
    isNewRealmProvisioningStep(step.key) && step.status === 'offen'
  );
  return pendingArtifact
    ? createOperationsPrimaryAction('execute_provisioning', 'run_retry')
    : undefined;
};

const buildNewRealmFinalAction = (model: RealmOperationsModel): OperationsPrimaryAction => {
  if (findOperationsStep(model, 'final_validation')?.status === 'fehlgeschlagen') {
    return createOperationsPrimaryAction('check_keycloak_status', 'final_validation');
  }
  const followUpAction = model.followUpActions[0];
  return followUpAction
    ? createOperationsPrimaryAction(followUpAction, 'follow_up')
    : createOperationsPrimaryAction('check_keycloak_status', 'final_validation');
};

const buildNewRealmPrimaryAction = (model: RealmOperationsModel): OperationsPrimaryAction => {
  const prerequisiteAction = buildNewRealmPrerequisiteAction(model);
  if (prerequisiteAction) {
    return prerequisiteAction;
  }
  const completedFollowUpAction = buildCompletedNewRealmFollowUpAction(model);
  if (completedFollowUpAction) {
    return completedFollowUpAction;
  }
  return buildNewRealmWorkerAction(model) ?? buildNewRealmFinalAction(model);
};

const buildExistingRealmPrerequisiteAction = (
  model: RealmOperationsModel
): OperationsPrimaryAction | undefined => {
  const contractStep = model.steps.find(
    (step) => step.key === 'registry_contract' || step.key === 'contract_repair'
  );
  if (contractStep?.status === 'fehlgeschlagen') {
    return createOperationsPrimaryAction('focus_configuration', 'missing_contract');
  }
  return findOperationsStep(model, 'worker_preflight')?.status === 'fehlgeschlagen'
    ? createOperationsPrimaryAction('check_preflight', 'preflight_blocked')
    : undefined;
};

const buildExistingRealmPrimaryAction = (model: RealmOperationsModel): OperationsPrimaryAction => {
  const prerequisiteAction = buildExistingRealmPrerequisiteAction(model);
  if (prerequisiteAction) {
    return prerequisiteAction;
  }
  if (findOperationsStep(model, 'live_status')?.status === 'bereit') {
    return createOperationsPrimaryAction('check_keycloak_status', 'final_validation');
  }
  if (model.signals.hasDrift || findOperationsStep(model, 'reconcile')?.status === 'fehlgeschlagen') {
    return createOperationsPrimaryAction('reconcileKeycloak', 'run_retry');
  }
  return createOperationsPrimaryAction('check_keycloak_status', 'final_validation');
};

export const buildOperationsPrimaryAction = (
  model: RealmOperationsModel
): OperationsPrimaryAction =>
  model.mode === 'new'
    ? buildNewRealmPrimaryAction(model)
    : buildExistingRealmPrimaryAction(model);

export const buildHistoryWorkspaceModel = (
  instance: IamInstanceDetail,
  operationsModel: RealmOperationsModel
): HistoryWorkspaceModel => {
  const currentRun = readLatestKeycloakRun(instance);
  const historicalRuns = instance.keycloakProvisioningRuns.filter((run) => run.id !== currentRun?.id);
  const hasHistoricalMismatchHint = Boolean(
    currentRun?.overallStatus === 'succeeded'
    && historicalRuns.some((run) => run.overallStatus === 'failed')
    && operationsModel.status !== 'unknown'
  );

  return {
    currentRun: currentRun ?? undefined,
    historicalRuns,
    hasHistoricalMismatchHint,
  };
};

export const ProvisioningStepBadge = ({
  status,
}: {
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'unchanged';
}) => {
  const ready = status === 'done' || status === 'skipped' || status === 'unchanged';
  return <Badge variant={ready ? 'secondary' : 'outline'}>{status}</Badge>;
};
