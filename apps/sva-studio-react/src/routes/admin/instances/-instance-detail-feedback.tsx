import { Alert, AlertDescription } from '../../../components/ui/alert';
import { t } from '../../../i18n';
import type { useInstances } from '../../../hooks/use-instances';
import { IamRuntimeDiagnosticDetails } from '../-iam-runtime-diagnostic-details';
import { getErrorMessage } from './-instance-error-messages';
import {
  formatDateTime,
  readActionFeedbackClassName,
  readPreflightTimestamp,
  type ActionFeedback,
} from './-instance-detail-page-helpers';

const InstanceRuntimeEvidence = ({
  classification,
  instance,
}: {
  classification?: string;
  instance: ReturnType<typeof useInstances>['selectedInstance'];
}) => {
  if (!instance) {
    return null;
  }

  if (
    classification !== 'registry_or_provisioning_drift' &&
    classification !== 'keycloak_reconcile'
  ) {
    return null;
  }

  const preflightTimestamp = readPreflightTimestamp(instance);
  const latestRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];

  if (!instance.keycloakPreflight && !instance.keycloakPlan && !latestRun) {
    return null;
  }

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {instance.keycloakPreflight ? (
        <p>
          {t('admin.instances.diagnostics.preflightEvidence', {
            status: instance.keycloakPreflight.overallStatus,
            checkedAt: formatDateTime(preflightTimestamp),
          })}
        </p>
      ) : null}
      {instance.keycloakPlan ? (
        <p>
          {t('admin.instances.diagnostics.planEvidence', {
            summary: instance.keycloakPlan.driftSummary,
          })}
        </p>
      ) : null}
      {latestRun ? (
        <p>
          {t('admin.instances.diagnostics.latestRunEvidence', {
            requestId: latestRun.requestId ?? t('shell.runtimeHealth.notAvailable'),
            status: latestRun.overallStatus,
          })}
        </p>
      ) : null}
    </div>
  );
};

export const InstanceDetailFeedback = ({
  actionFeedback,
  actionFeedbackFading,
  missingWorkerEnvName,
  workerPendingProjection,
  workerUnavailableWarning,
  mutationError,
  selectedInstance,
}: {
  actionFeedback: ActionFeedback | null;
  actionFeedbackFading: boolean;
  missingWorkerEnvName: string | undefined;
  workerPendingProjection: boolean;
  workerUnavailableWarning: boolean;
  mutationError: ReturnType<typeof useInstances>['mutationError'];
  selectedInstance: ReturnType<typeof useInstances>['selectedInstance'];
}) => (
  <>
    {actionFeedback ? (
      <Alert className={readActionFeedbackClassName(actionFeedback, actionFeedbackFading)}>
        <AlertDescription>{actionFeedback.message}</AlertDescription>
      </Alert>
    ) : null}

    {missingWorkerEnvName ? (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>
          {t('admin.instances.feedback.workerEnvMissing', {
            envName: missingWorkerEnvName,
          })}
        </AlertDescription>
      </Alert>
    ) : null}

    {workerPendingProjection && !missingWorkerEnvName ? (
      <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertDescription>{t('admin.instances.feedback.workerProjectionHint')}</AlertDescription>
      </Alert>
    ) : null}

    {workerUnavailableWarning && !missingWorkerEnvName ? (
      <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertDescription>{t('admin.instances.feedback.workerUnavailable')}</AlertDescription>
      </Alert>
    ) : null}

    {mutationError ? (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription className="flex flex-col gap-3">
          <span>{getErrorMessage(mutationError)}</span>
          <IamRuntimeDiagnosticDetails error={mutationError} />
          <InstanceRuntimeEvidence
            classification={mutationError.classification}
            instance={selectedInstance}
          />
        </AlertDescription>
      </Alert>
    ) : null}
  </>
);
