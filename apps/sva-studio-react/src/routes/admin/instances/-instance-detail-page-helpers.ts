import type { useInstances } from '../../../hooks/use-instances';
import { formatEditorDateTime } from '../../../lib/editor-date-time';
import {
  buildExistingRealmOperationsModel,
  buildNewRealmOperationsModel,
} from './-instance-detail-models';
import {
  createDetailForm,
  isTenantSecretUserInputRequired,
} from './-instance-form-models';

export type ActionFeedback = Readonly<{
  tone: 'success' | 'warning';
  message: string;
}>;

type SelectedInstance = ReturnType<typeof useInstances>['selectedInstance'];

export const formatDateTime = (value?: string) => {
  if (!value) {
    return '—';
  }
  return formatEditorDateTime(value) ?? value;
};

const readActualLatestKeycloakRun = (instance: SelectedInstance) =>
  instance?.keycloakProvisioningRuns[0] ?? instance?.latestKeycloakProvisioningRun;

export const readPreflightTimestamp = (instance: SelectedInstance) => {
  if (!instance?.keycloakPreflight || typeof instance.keycloakPreflight !== 'object') {
    return undefined;
  }

  if ('checkedAt' in instance.keycloakPreflight && typeof instance.keycloakPreflight.checkedAt === 'string') {
    return instance.keycloakPreflight.checkedAt;
  }

  if (
    'generatedAt' in instance.keycloakPreflight &&
    typeof (instance.keycloakPreflight as { generatedAt?: string }).generatedAt === 'string'
  ) {
    return (instance.keycloakPreflight as { generatedAt?: string }).generatedAt;
  }

  return undefined;
};

export const readWorkerPendingProjection = (instance: SelectedInstance) =>
  Boolean(
    instance?.keycloakPreflight?.checks.some((check) => {
      const details = check.details as Record<string, unknown> | undefined;
      return details?.source === 'worker_pending';
    })
  );

export const readMissingWorkerEnvName = (instance: SelectedInstance) => {
  const preflightStep = readActualLatestKeycloakRun(instance)?.steps.find(
    (step) => step.stepKey === 'worker_preflight_snapshot'
  );
  const details = preflightStep?.details as
    | {
        preflight?: {
          checks?: Array<{
            checkKey?: string;
            details?: {
              error?: string;
            };
          }>;
        };
      }
    | undefined;
  const keycloakAccessCheck = details?.preflight?.checks?.find((check) => check.checkKey === 'keycloak_admin_access');
  const error = keycloakAccessCheck?.details?.error;
  if (!error?.startsWith('Missing required env: ')) {
    return undefined;
  }
  return error.replace('Missing required env: ', '').trim() || undefined;
};

export const readWorkerUnavailableWarning = (
  instance: SelectedInstance,
  warningThresholdMs: number
) => {
  const latestRun = readActualLatestKeycloakRun(instance);
  if (!latestRun || latestRun.overallStatus !== 'planned') {
    return false;
  }

  const hasWorkerEvidence = latestRun.steps.some((step) =>
    step.stepKey === 'worker' || step.stepKey === 'execution' || step.stepKey.startsWith('worker_')
  );
  if (hasWorkerEvidence) {
    return false;
  }

  const referenceTimestamp = Date.parse(latestRun.updatedAt || latestRun.createdAt);
  if (Number.isNaN(referenceTimestamp)) {
    return false;
  }

  return Date.now() - referenceTimestamp >= warningThresholdMs;
};

export const readTenantSecretUserInputRequired = (
  detailFormValues: ReturnType<typeof createDetailForm> | null,
  selectedInstance: SelectedInstance
) => {
  if (detailFormValues) {
    return isTenantSecretUserInputRequired(detailFormValues.realmMode);
  }

  if (selectedInstance) {
    return isTenantSecretUserInputRequired(selectedInstance.realmMode);
  }

  return true;
};

export const readOperationsModel = (
  selectedInstance: SelectedInstance,
  mutationError: ReturnType<typeof useInstances>['mutationError']
) => {
  if (!selectedInstance) {
    return null;
  }

  if (selectedInstance.realmMode === 'new') {
    return buildNewRealmOperationsModel(selectedInstance, mutationError);
  }

  return buildExistingRealmOperationsModel(selectedInstance, mutationError);
};

export const readActionFeedbackClassName = (
  actionFeedback: ActionFeedback,
  actionFeedbackFading: boolean
) => {
  const opacityClassName = actionFeedbackFading ? 'opacity-0' : 'opacity-100';

  if (actionFeedback.tone === 'success') {
    return `border-emerald-500/40 bg-emerald-500/10 text-emerald-900 transition-opacity duration-300 ${opacityClassName}`;
  }

  return `border-amber-500/40 bg-amber-500/10 text-amber-950 transition-opacity duration-300 ${opacityClassName}`;
};

export const clearSensitiveDetailFields = (current: ReturnType<typeof createDetailForm> | null) => {
  if (!current) {
    return current;
  }

  return {
    ...current,
    authClientSecret: '',
    tenantAdminClient: {
      ...current.tenantAdminClient,
      secret: '',
    },
  };
};
