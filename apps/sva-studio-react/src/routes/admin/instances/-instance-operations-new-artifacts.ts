import type { IamInstanceDetail } from '@sva/core';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import { findPreflightCheck } from './-instance-detail-shared';
import type {
  OperationsStepModel,
  RealmOperationsModel,
} from './-instance-detail-operations-types';
import {
  NEW_REALM_STEP_TITLES,
  createOperationStep,
  deriveOperationsModelStatus,
  isFinalKeycloakStateSatisfied,
  isRegistryContractComplete,
  readLatestKeycloakRun,
  readProvisioningRunState,
  readRunTimestamp,
} from './-instance-operations-shared';
import {
  buildNewRealmLeadSteps,
  buildNewRealmOperationsSummary,
  buildNewRealmFollowUpActions,
} from './-instance-operations-new-lead';

type NewRealmArtifactContext = {
  instance: IamInstanceDetail;
  latestRun: IamInstanceDetail['latestKeycloakProvisioningRun'];
  runState: ReturnType<typeof readProvisioningRunState>;
};

const readNewRealmArtifactState = (
  satisfied: boolean,
  runState: ReturnType<typeof readProvisioningRunState>,
  failedSummaryKey: string,
  readySummaryKey: string
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
}: NewRealmArtifactContext): OperationsStepModel =>
  createOperationStep({
    key: 'realm',
    title: t(NEW_REALM_STEP_TITLES.realm),
    evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
    checkedAt: readRunTimestamp(latestRun),
    requestId: latestRun?.requestId,
    ...readNewRealmArtifactState(
      Boolean(instance.keycloakStatus?.realmExists),
      runState,
      'admin.instances.operations.new.stepSummaries.realmFailed',
      'admin.instances.operations.new.stepSummaries.realmReady'
    ),
  });

const buildNewRealmLoginClientStep = ({
  instance,
  latestRun,
  runState,
}: NewRealmArtifactContext): OperationsStepModel =>
  createOperationStep({
    key: 'login_client',
    title: t(NEW_REALM_STEP_TITLES.login_client),
    evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
    checkedAt: readRunTimestamp(latestRun),
    requestId: latestRun?.requestId,
    ...readNewRealmArtifactState(
      Boolean(
        instance.keycloakStatus?.clientExists &&
        instance.keycloakStatus.redirectUrisMatch &&
        instance.keycloakStatus.logoutUrisMatch &&
        instance.keycloakStatus.webOriginsMatch
      ),
      runState,
      'admin.instances.operations.new.stepSummaries.loginClientFailed',
      'admin.instances.operations.new.stepSummaries.loginClientReady'
    ),
  });

const buildNewRealmTenantAdminClientStep = ({
  instance,
  latestRun,
  runState,
}: NewRealmArtifactContext): OperationsStepModel =>
  createOperationStep({
    key: 'tenant_admin_client',
    title: t(NEW_REALM_STEP_TITLES.tenant_admin_client),
    evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
    checkedAt: readRunTimestamp(latestRun),
    requestId: latestRun?.requestId,
    ...readNewRealmArtifactState(
      Boolean(instance.keycloakStatus?.tenantAdminClientExists),
      runState,
      'admin.instances.operations.new.stepSummaries.tenantAdminClientFailed',
      'admin.instances.operations.new.stepSummaries.tenantAdminClientReady'
    ),
  });

const buildNewRealmRolesStep = ({
  instance,
  latestRun,
  runState,
}: NewRealmArtifactContext): OperationsStepModel =>
  createOperationStep({
    key: 'realm_roles',
    title: t(NEW_REALM_STEP_TITLES.realm_roles),
    evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
    checkedAt: readRunTimestamp(latestRun),
    requestId: latestRun?.requestId,
    ...readNewRealmArtifactState(
      Boolean(instance.keycloakStatus?.tenantAdminHasSystemAdmin),
      runState,
      'admin.instances.operations.new.stepSummaries.realmRolesFailed',
      'admin.instances.operations.new.stepSummaries.realmRolesReady'
    ),
  });

const buildNewRealmTenantAdminStep = ({
  instance,
  latestRun,
  runState,
}: NewRealmArtifactContext): OperationsStepModel =>
  createOperationStep({
    key: 'tenant_admin',
    title: t(NEW_REALM_STEP_TITLES.tenant_admin),
    evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
    checkedAt: readRunTimestamp(latestRun),
    requestId: latestRun?.requestId,
    ...readNewRealmArtifactState(
      Boolean(instance.keycloakStatus?.tenantAdminExists),
      runState,
      'admin.instances.operations.new.stepSummaries.tenantAdminFailed',
      'admin.instances.operations.new.stepSummaries.tenantAdminReady'
    ),
  });

const buildNewRealmSecretSyncStep = ({
  instance,
  latestRun,
  runState,
}: NewRealmArtifactContext): OperationsStepModel =>
  createOperationStep({
    key: 'secret_sync',
    title: t(NEW_REALM_STEP_TITLES.secret_sync),
    evidenceSource: instance.keycloakStatus ? 'final_validation' : 'keycloak_run',
    checkedAt: readRunTimestamp(latestRun),
    requestId: latestRun?.requestId,
    ...readNewRealmArtifactState(
      Boolean(
        instance.keycloakStatus?.clientSecretAligned &&
        instance.keycloakStatus.tenantAdminClientSecretAligned
      ),
      runState,
      'admin.instances.operations.new.stepSummaries.secretSyncFailed',
      'admin.instances.operations.new.stepSummaries.secretSyncReady'
    ),
  });

const readNewRealmFinalValidationStatus = (
  instance: IamInstanceDetail,
  runState: ReturnType<typeof readProvisioningRunState>
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
  requestId: string | undefined
): OperationsStepModel => {
  const status = readNewRealmFinalValidationStatus(instance, runState);
  return createOperationStep({
    key: 'final_validation',
    title: t(NEW_REALM_STEP_TITLES.final_validation),
    evidenceSource: 'final_validation',
    checkedAt: instance.updatedAt,
    requestId,
    status,
    summary:
      status === 'erfolgreich'
        ? t('admin.instances.operations.new.stepSummaries.finalValidationReady')
        : status === 'fehlgeschlagen'
          ? t('admin.instances.operations.new.stepSummaries.finalValidationFailed')
          : t('admin.instances.operations.new.stepSummaries.finalValidationPending'),
  });
};

const buildNewRealmBootstrapCompleteStep = (
  instance: IamInstanceDetail,
  requestId: string | undefined
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
  _mutationError: IamHttpError | null
): RealmOperationsModel => {
  const contractComplete = isRegistryContractComplete(instance);
  const preflight = instance.keycloakPreflight;
  const plan = instance.keycloakPlan;
  const latestRun = readLatestKeycloakRun(instance);
  const runState = readProvisioningRunState(latestRun);
  const realmModeBlocked = findPreflightCheck(preflight, 'realm_mode')?.status === 'blocked';
  const steps: OperationsStepModel[] = buildNewRealmLeadSteps(
    instance,
    contractComplete,
    preflight,
    plan
  );

  steps.push(...buildNewRealmArtifactSteps(instance));

  return {
    mode: 'new',
    status: deriveOperationsModelStatus(steps),
    summary: buildNewRealmOperationsSummary(
      instance,
      contractComplete,
      preflight,
      runState,
      realmModeBlocked
    ),
    steps,
    followUpActions: buildNewRealmFollowUpActions(instance),
    signals: {
      modeConflict: realmModeBlocked,
      hasDrift: false,
    },
  };
};
