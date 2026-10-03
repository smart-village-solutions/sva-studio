import type { IamInstanceDetail } from '@sva/core';
import { t } from '../../../i18n';
import type {
  OperationsStepModel,
  RealmOperationsModel,
} from './-instance-detail-operations-types';
import {
  NEW_REALM_STEP_TITLES,
  buildWorkerPreflightStep,
  createOperationStep,
  isFinalKeycloakStateSatisfied,
  readProvisioningRunState,
} from './-instance-operations-shared';

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

export const buildNewRealmLeadSteps = (
  instance: IamInstanceDetail,
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
  plan: IamInstanceDetail['keycloakPlan']
): OperationsStepModel[] => [
  buildNewRealmRegistryContractStep(instance, contractComplete),
  buildWorkerPreflightStep('new', contractComplete, preflight),
  buildNewRealmWorkerPlanStep(contractComplete, preflight, plan),
];

export const buildNewRealmOperationsSummary = (
  instance: IamInstanceDetail,
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
  runState: ReturnType<typeof readProvisioningRunState>,
  realmModeBlocked: boolean
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

export const buildNewRealmFollowUpActions = (
  instance: IamInstanceDetail
): RealmOperationsModel['followUpActions'] =>
  instance.status !== 'active' && isFinalKeycloakStateSatisfied(instance)
    ? ['activate_instance']
    : [];
