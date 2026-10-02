import type { IamInstanceDetail } from '@sva/core';
import { Badge } from '../../../components/ui/badge';
import type {
  HistoryWorkspaceModel,
  OperationsPrimaryAction,
  OperationsStepKey,
  RealmOperationsModel,
} from './-instance-detail-operations-types';
import { getInstanceErrorMessage } from './-instance-error-message-shared';
import {
  getOperationsActionLabel,
  isNewRealmProvisioningStep,
  readLatestKeycloakRun,
} from './-instance-operations-shared';
export {
  getOperationsActionLabel,
  getOperationsEvidenceSourceLabel,
} from './-instance-operations-shared';
export { buildNewRealmOperationsModel } from './-instance-operations-new-artifacts';
export { buildExistingRealmOperationsModel } from './-instance-operations-existing';

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
  const failedArtifact = model.steps.find(
    (step) => isNewRealmProvisioningStep(step.key) && step.status === 'fehlgeschlagen'
  );
  if (failedArtifact) {
    return createOperationsPrimaryAction('execute_provisioning', 'run_retry');
  }
  const pendingArtifact = model.steps.find(
    (step) => isNewRealmProvisioningStep(step.key) && step.status === 'offen'
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
  if (
    model.signals.hasDrift ||
    findOperationsStep(model, 'reconcile')?.status === 'fehlgeschlagen'
  ) {
    return createOperationsPrimaryAction('reconcileKeycloak', 'run_retry');
  }
  return createOperationsPrimaryAction('check_keycloak_status', 'final_validation');
};

export const buildOperationsPrimaryAction = (
  model: RealmOperationsModel
): OperationsPrimaryAction =>
  model.mode === 'new' ? buildNewRealmPrimaryAction(model) : buildExistingRealmPrimaryAction(model);

export const buildHistoryWorkspaceModel = (
  instance: IamInstanceDetail,
  operationsModel: RealmOperationsModel
): HistoryWorkspaceModel => {
  const currentRun = readLatestKeycloakRun(instance);
  const historicalRuns = instance.keycloakProvisioningRuns.filter(
    (run) => run.id !== currentRun?.id
  );
  const hasHistoricalMismatchHint = Boolean(
    currentRun?.overallStatus === 'succeeded' &&
    historicalRuns.some((run) => run.overallStatus === 'failed') &&
    operationsModel.status !== 'unknown'
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
