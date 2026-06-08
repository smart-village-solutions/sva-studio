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

const buildWorkerPreflightStep = (
  mode: 'new' | 'existing',
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
): OperationsStepModel => {
  const blocked = preflight?.overallStatus === 'blocked';
  const pending = !contractComplete;
  const ready = Boolean(preflight);

  return createOperationStep({
    key: 'worker_preflight',
    title: t(
      mode === 'new'
        ? NEW_REALM_STEP_TITLES.worker_preflight
        : EXISTING_REALM_STEP_TITLES.worker_preflight
    ),
    status: pending
      ? 'offen'
      : blocked
        ? 'fehlgeschlagen'
        : ready
          ? 'erfolgreich'
          : 'bereit',
    summary: pending
      ? t(
        mode === 'new'
          ? 'admin.instances.operations.new.stepSummaries.workerPreflightPending'
          : 'admin.instances.operations.existing.stepSummaries.workerPreflightPending'
      )
      : blocked
        ? (
          mode === 'new'
            ? findPreflightCheck(preflight, 'realm_mode')?.summary
              ?? t('admin.instances.operations.new.stepSummaries.workerPreflightFailed')
            : t('admin.instances.operations.existing.stepSummaries.workerPreflightFailed')
        )
        : ready
          ? t(
            mode === 'new'
              ? 'admin.instances.operations.new.stepSummaries.workerPreflightReady'
              : 'admin.instances.operations.existing.stepSummaries.workerPreflightReady'
          )
          : t(
            mode === 'new'
              ? 'admin.instances.operations.new.stepSummaries.workerPreflightReadyToRun'
              : 'admin.instances.operations.existing.stepSummaries.workerPreflightReadyToRun'
          ),
    evidenceSource: 'worker_preflight',
    checkedAt: readPreflightTimestamp(preflight),
    action: contractComplete && !preflight ? 'check_preflight' : undefined,
  });
};

const buildNewRealmLeadSteps = (
  instance: IamInstanceDetail,
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
  plan: IamInstanceDetail['keycloakPlan'],
): OperationsStepModel[] => [
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
  }),
  buildWorkerPreflightStep('new', contractComplete, preflight),
  createOperationStep({
    key: 'worker_plan',
    title: t(NEW_REALM_STEP_TITLES.worker_plan),
    status: !contractComplete || preflight?.overallStatus === 'blocked'
      ? 'offen'
      : plan?.overallStatus === 'blocked'
        ? 'fehlgeschlagen'
        : plan
          ? 'erfolgreich'
          : 'bereit',
    summary: !contractComplete || preflight?.overallStatus === 'blocked'
      ? t('admin.instances.operations.new.stepSummaries.workerPlanPending')
      : plan?.overallStatus === 'blocked'
        ? plan.driftSummary
        : plan
          ? t('admin.instances.operations.new.stepSummaries.workerPlanReady')
          : t('admin.instances.operations.new.stepSummaries.workerPlanReadyToRun'),
    evidenceSource: 'worker_plan',
    checkedAt: plan?.generatedAt,
    action: contractComplete && preflight && !plan ? 'plan_provisioning' : undefined,
  }),
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

const buildNewRealmArtifactSteps = (instance: IamInstanceDetail): OperationsStepModel[] => {
  const latestRun = readLatestKeycloakRun(instance);
  const runState = readProvisioningRunState(latestRun);
  const checkedAt = readRunTimestamp(latestRun);
  const requestId = latestRun?.requestId;
  const keycloakStatus = instance.keycloakStatus;

  const artifactState = (
    satisfied: boolean,
    failedSummaryKey: string,
    readySummaryKey: string
  ): Pick<OperationsStepModel, 'status' | 'summary'> => {
    if (satisfied) {
      return {
        status: 'erfolgreich',
        summary: t(readySummaryKey),
      };
    }
    if (runState.failed) {
      return {
        status: 'fehlgeschlagen',
        summary: t(failedSummaryKey),
      };
    }
    if (runState.running || runState.planned) {
      return {
        status: 'läuft',
        summary: t('admin.instances.operations.new.stepSummaries.awaitingCurrentRun'),
      };
    }
    if (runState.succeeded) {
      return {
        status: 'fehlgeschlagen',
        summary: t(failedSummaryKey),
      };
    }
    return {
      status: 'offen',
      summary: t('admin.instances.operations.new.stepSummaries.pendingWorkerExecution'),
    };
  };

  return [
    createOperationStep({
      key: 'realm',
      title: t(NEW_REALM_STEP_TITLES.realm),
      evidenceSource: keycloakStatus ? 'final_validation' : 'keycloak_run',
      checkedAt,
      requestId,
      ...artifactState(
        Boolean(keycloakStatus?.realmExists),
        'admin.instances.operations.new.stepSummaries.realmFailed',
        'admin.instances.operations.new.stepSummaries.realmReady'
      ),
    }),
    createOperationStep({
      key: 'login_client',
      title: t(NEW_REALM_STEP_TITLES.login_client),
      evidenceSource: keycloakStatus ? 'final_validation' : 'keycloak_run',
      checkedAt,
      requestId,
      ...artifactState(
        Boolean(
          keycloakStatus?.clientExists
            && keycloakStatus.redirectUrisMatch
            && keycloakStatus.logoutUrisMatch
            && keycloakStatus.webOriginsMatch
        ),
        'admin.instances.operations.new.stepSummaries.loginClientFailed',
        'admin.instances.operations.new.stepSummaries.loginClientReady'
      ),
    }),
    createOperationStep({
      key: 'tenant_admin_client',
      title: t(NEW_REALM_STEP_TITLES.tenant_admin_client),
      evidenceSource: keycloakStatus ? 'final_validation' : 'keycloak_run',
      checkedAt,
      requestId,
      ...artifactState(
        Boolean(keycloakStatus?.tenantAdminClientExists),
        'admin.instances.operations.new.stepSummaries.tenantAdminClientFailed',
        'admin.instances.operations.new.stepSummaries.tenantAdminClientReady'
      ),
    }),
    createOperationStep({
      key: 'realm_roles',
      title: t(NEW_REALM_STEP_TITLES.realm_roles),
      evidenceSource: keycloakStatus ? 'final_validation' : 'keycloak_run',
      checkedAt,
      requestId,
      ...artifactState(
        Boolean(keycloakStatus?.tenantAdminHasSystemAdmin),
        'admin.instances.operations.new.stepSummaries.realmRolesFailed',
        'admin.instances.operations.new.stepSummaries.realmRolesReady'
      ),
    }),
    createOperationStep({
      key: 'tenant_admin',
      title: t(NEW_REALM_STEP_TITLES.tenant_admin),
      evidenceSource: keycloakStatus ? 'final_validation' : 'keycloak_run',
      checkedAt,
      requestId,
      ...artifactState(
        Boolean(keycloakStatus?.tenantAdminExists),
        'admin.instances.operations.new.stepSummaries.tenantAdminFailed',
        'admin.instances.operations.new.stepSummaries.tenantAdminReady'
      ),
    }),
    createOperationStep({
      key: 'secret_sync',
      title: t(NEW_REALM_STEP_TITLES.secret_sync),
      evidenceSource: keycloakStatus ? 'final_validation' : 'keycloak_run',
      checkedAt,
      requestId,
      ...artifactState(
        Boolean(keycloakStatus?.clientSecretAligned && keycloakStatus.tenantAdminClientSecretAligned),
        'admin.instances.operations.new.stepSummaries.secretSyncFailed',
        'admin.instances.operations.new.stepSummaries.secretSyncReady'
      ),
    }),
    createOperationStep({
      key: 'final_validation',
      title: t(NEW_REALM_STEP_TITLES.final_validation),
      evidenceSource: 'final_validation',
      checkedAt: instance.updatedAt,
      requestId,
      status: isFinalKeycloakStateSatisfied(instance)
        ? 'erfolgreich'
        : runState.failed || runState.succeeded
          ? 'fehlgeschlagen'
          : runState.running || runState.planned
            ? 'läuft'
            : 'offen',
      summary: isFinalKeycloakStateSatisfied(instance)
        ? t('admin.instances.operations.new.stepSummaries.finalValidationReady')
        : runState.failed || runState.succeeded
            ? t('admin.instances.operations.new.stepSummaries.finalValidationFailed')
            : t('admin.instances.operations.new.stepSummaries.finalValidationPending'),
    }),
    createOperationStep({
      key: 'realm_bootstrap_complete',
      title: t(NEW_REALM_STEP_TITLES.realm_bootstrap_complete),
      evidenceSource: 'final_validation',
      checkedAt: instance.updatedAt,
      requestId,
      status: isFinalKeycloakStateSatisfied(instance) ? 'erfolgreich' : 'offen',
      summary: isFinalKeycloakStateSatisfied(instance)
        ? t('admin.instances.operations.new.stepSummaries.bootstrapCompleteReady')
        : t('admin.instances.operations.new.stepSummaries.bootstrapCompletePending'),
    }),
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
  createOperationStep({
    key: 'registry_contract',
    title: t(EXISTING_REALM_STEP_TITLES.registry_contract),
    status: contractComplete ? 'erfolgreich' : 'fehlgeschlagen',
    summary: contractComplete
      ? t('admin.instances.operations.existing.stepSummaries.registryContractReady')
      : t('admin.instances.operations.existing.stepSummaries.registryContractFailed'),
    evidenceSource: 'registry_contract',
    checkedAt: instance.updatedAt,
    action: contractComplete ? undefined : 'focus_configuration',
  }),
  buildWorkerPreflightStep('existing', contractComplete, preflight),
  createOperationStep({
    key: 'live_status',
    title: t(EXISTING_REALM_STEP_TITLES.live_status),
    status: instance.keycloakStatus
      ? 'erfolgreich'
      : preflight?.overallStatus === 'blocked'
        ? 'offen'
        : 'bereit',
    summary: instance.keycloakStatus
      ? t('admin.instances.operations.existing.stepSummaries.liveStatusReady')
      : t('admin.instances.operations.existing.stepSummaries.liveStatusPending'),
    evidenceSource: instance.keycloakStatus ? 'final_validation' : 'worker_preflight',
    checkedAt: instance.updatedAt,
    action: instance.keycloakStatus ? undefined : 'check_keycloak_status',
  }),
  createOperationStep({
    key: 'drift_analysis',
    title: t(EXISTING_REALM_STEP_TITLES.drift_analysis),
    status: !instance.keycloakStatus
      ? 'offen'
      : hasDrift
        ? 'fehlgeschlagen'
        : 'erfolgreich',
    summary: !instance.keycloakStatus
      ? t('admin.instances.operations.existing.stepSummaries.driftAnalysisPending')
      : hasDrift
        ? t('admin.instances.operations.existing.stepSummaries.driftAnalysisFailed')
        : t('admin.instances.operations.existing.stepSummaries.driftAnalysisReady'),
    evidenceSource: instance.keycloakStatus ? 'final_validation' : 'history',
    checkedAt: instance.updatedAt,
  }),
  createOperationStep({
    key: 'contract_repair',
    title: t(EXISTING_REALM_STEP_TITLES.contract_repair),
    status: contractComplete ? 'erfolgreich' : 'fehlgeschlagen',
    summary: contractComplete
      ? t('admin.instances.operations.existing.stepSummaries.contractRepairReady')
      : t('admin.instances.operations.existing.stepSummaries.contractRepairFailed'),
    evidenceSource: 'registry_contract',
    checkedAt: instance.updatedAt,
    action: contractComplete ? undefined : 'focus_configuration',
  }),
  createOperationStep({
    key: 'reconcile',
    title: t(EXISTING_REALM_STEP_TITLES.reconcile),
    status: !instance.keycloakStatus
      ? 'offen'
      : latestRun?.overallStatus === 'failed'
        ? 'fehlgeschlagen'
        : hasDrift
          ? 'bereit'
          : 'erfolgreich',
    summary: !instance.keycloakStatus
      ? t('admin.instances.operations.existing.stepSummaries.reconcilePending')
      : latestRun?.overallStatus === 'failed'
        ? t('admin.instances.operations.existing.stepSummaries.reconcileFailed')
        : hasDrift
          ? t('admin.instances.operations.existing.stepSummaries.reconcileReadyToRun')
          : t('admin.instances.operations.existing.stepSummaries.reconcileReady'),
    evidenceSource: latestRun ? 'keycloak_run' : 'final_validation',
    checkedAt: readRunTimestamp(latestRun) ?? instance.updatedAt,
    requestId: latestRun?.requestId,
    action: instance.keycloakStatus && hasDrift ? 'reconcileKeycloak' : undefined,
  }),
  createOperationStep({
    key: 'result_validation',
    title: t(EXISTING_REALM_STEP_TITLES.result_validation),
    status: !instance.keycloakStatus
      ? 'offen'
      : hasDrift
        ? 'fehlgeschlagen'
        : 'erfolgreich',
    summary: !instance.keycloakStatus
      ? t('admin.instances.operations.existing.stepSummaries.resultValidationPending')
      : hasDrift
        ? t('admin.instances.operations.existing.stepSummaries.resultValidationFailed')
        : t('admin.instances.operations.existing.stepSummaries.resultValidationReady'),
    evidenceSource: 'final_validation',
    checkedAt: instance.updatedAt,
  }),
];

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

export const buildOperationsPrimaryAction = (model: RealmOperationsModel): OperationsPrimaryAction => {
  if (model.mode === 'new') {
    const contractStep = model.steps.find((step) => step.key === 'registry_contract');
    if (contractStep?.status === 'fehlgeschlagen') {
      return {
        action: 'focus_configuration',
        label: getOperationsActionLabel('focus_configuration'),
        reason: 'missing_contract',
      };
    }
    const preflightStep = model.steps.find((step) => step.key === 'worker_preflight');
    if (model.signals.modeConflict) {
      return {
        action: 'check_preflight',
        label: getOperationsActionLabel('check_preflight'),
        reason: 'mode_conflict',
      };
    }
    if (preflightStep?.status === 'fehlgeschlagen') {
      return {
        action: 'check_preflight',
        label: getOperationsActionLabel('check_preflight'),
        reason: 'preflight_blocked',
      };
    }
    const finalValidationStep = model.steps.find((step) => step.key === 'final_validation');
    const followUpAction = model.followUpActions[0];
    if (finalValidationStep?.status === 'erfolgreich' && followUpAction) {
      return {
        action: followUpAction,
        label: getOperationsActionLabel(followUpAction),
        reason: 'follow_up',
      };
    }
    const workerPlanStep = model.steps.find((step) => step.key === 'worker_plan');
    if (workerPlanStep?.status === 'bereit' || workerPlanStep?.status === 'fehlgeschlagen') {
      return {
        action: 'plan_provisioning',
        label: getOperationsActionLabel('plan_provisioning'),
        reason: 'follow_up',
      };
    }
    const latestFailure = model.steps.find((step) =>
      isNewRealmProvisioningStep(step.key)
      && step.status === 'fehlgeschlagen'
    );
    if (latestFailure) {
      return {
        action: 'execute_provisioning',
        label: getOperationsActionLabel('execute_provisioning'),
        reason: 'run_retry',
      };
    }
    const secretSyncStep = model.steps.find((step) => step.key === 'secret_sync');
    if (secretSyncStep?.status === 'fehlgeschlagen') {
      return {
        action: 'execute_provisioning',
        label: getOperationsActionLabel('execute_provisioning'),
        reason: 'secret_sync',
      };
    }
    const pendingArtifactStep = model.steps.find((step) =>
      isNewRealmProvisioningStep(step.key)
      && step.status === 'offen'
    );
    if (pendingArtifactStep) {
      return {
        action: 'execute_provisioning',
        label: getOperationsActionLabel('execute_provisioning'),
        reason: 'run_retry',
      };
    }
    if (finalValidationStep?.status === 'fehlgeschlagen') {
      return {
        action: 'check_keycloak_status',
        label: getOperationsActionLabel('check_keycloak_status'),
        reason: 'final_validation',
      };
    }
    if (followUpAction) {
      return {
        action: followUpAction,
        label: getOperationsActionLabel(followUpAction),
        reason: 'follow_up',
      };
    }
    return {
      action: 'check_keycloak_status',
      label: getOperationsActionLabel('check_keycloak_status'),
      reason: 'final_validation',
    };
  }

  const contractStep = model.steps.find((step) => step.key === 'registry_contract' || step.key === 'contract_repair');
  if (contractStep?.status === 'fehlgeschlagen') {
    return {
      action: 'focus_configuration',
      label: getOperationsActionLabel('focus_configuration'),
      reason: 'missing_contract',
    };
  }
  const preflightStep = model.steps.find((step) => step.key === 'worker_preflight');
  if (preflightStep?.status === 'fehlgeschlagen') {
    return {
      action: 'check_preflight',
      label: getOperationsActionLabel('check_preflight'),
      reason: 'preflight_blocked',
    };
  }
  const liveStatusStep = model.steps.find((step) => step.key === 'live_status');
  if (liveStatusStep?.status === 'bereit') {
    return {
      action: 'check_keycloak_status',
      label: getOperationsActionLabel('check_keycloak_status'),
      reason: 'final_validation',
    };
  }
  const reconcileStep = model.steps.find((step) => step.key === 'reconcile');
  if (model.signals.hasDrift || reconcileStep?.status === 'fehlgeschlagen') {
    return {
      action: 'reconcileKeycloak',
      label: getOperationsActionLabel('reconcileKeycloak'),
      reason: 'run_retry',
    };
  }
  return {
    action: 'check_keycloak_status',
    label: getOperationsActionLabel('check_keycloak_status'),
    reason: 'final_validation',
  };
};

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
