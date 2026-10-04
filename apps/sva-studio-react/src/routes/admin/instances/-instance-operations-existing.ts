import type { IamInstanceDetail } from '@sva/core';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';
import type {
  OperationsStepModel,
  RealmOperationsModel,
} from './-instance-detail-operations-types';
import {
  EXISTING_REALM_STEP_TITLES,
  buildWorkerPreflightStep,
  createOperationStep,
  deriveOperationsModelStatus,
  isFinalKeycloakStateSatisfied,
  readLatestKeycloakRun,
  readRunTimestamp,
} from './-instance-operations-shared';

const buildExistingRealmAssessmentSteps = (
  instance: IamInstanceDetail,
  contractComplete: boolean,
  preflight: IamInstanceDetail['keycloakPreflight'],
  latestRun: IamInstanceDetail['latestKeycloakProvisioningRun'],
  hasDrift: boolean
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
    status: !liveStatusAvailable ? 'offen' : hasDrift ? 'fehlgeschlagen' : 'erfolgreich',
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
    status: !liveStatusAvailable ? 'offen' : hasDrift ? 'fehlgeschlagen' : 'erfolgreich',
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
  _mutationError: IamHttpError | null
): RealmOperationsModel => {
  const contractComplete = Boolean(
    instance.displayName.trim() &&
    instance.parentDomain.trim() &&
    instance.authRealm.trim() &&
    instance.authClientId.trim() &&
    instance.authClientSecretConfigured &&
    instance.tenantAdminClient?.clientId?.trim()
  );
  const preflight = instance.keycloakPreflight;
  const latestRun = readLatestKeycloakRun(instance);
  const hasDrift = Boolean(instance.keycloakStatus && !isFinalKeycloakStateSatisfied(instance));
  const steps = buildExistingRealmAssessmentSteps(
    instance,
    contractComplete,
    preflight,
    latestRun,
    hasDrift
  );

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
