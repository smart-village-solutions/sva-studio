import { Button } from '@sva/studio-ui-react';
import type { DetailWorkflowAction } from './-instances-shared-types';
import type { ReactNode } from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import { InstanceDetailHistorySection } from './-instance-detail-history-section';
import { TenantIamStatusBadge, formatDateTime } from './-instance-detail-view-shared';

import type { HistoryWorkspaceModel } from './-instance-detail-operations-types';
import type { SelectedInstance } from './-instances-shared-types';
import type { InstanceDoctorModel } from './-instance-detail-doctor-model';

type InstanceDetailDoctorSectionProps = {
  readonly onRunDetailAction?: (
    action: DetailWorkflowAction | 'focus_configuration'
  ) => Promise<void>;
  readonly onOpenActivation?: () => void;
  readonly statusLoading?: boolean;
  readonly auditContent?: ReactNode;
  readonly secondaryActions?: readonly { action: DetailWorkflowAction; label: string }[];
  readonly doctorModel: InstanceDoctorModel;
  readonly historyModel: HistoryWorkspaceModel | null;
  readonly selectedInstance: SelectedInstance;
  readonly onLoadProvisioningRun: (runId: string) => Promise<unknown>;
};

const DoctorStepCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) => (
  <Card className="space-y-4 p-5">
    <div className="space-y-1">
      <div className="font-medium text-foreground">{title}</div>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
    {children}
  </Card>
);

export const InstanceDetailDoctorSection = ({
  doctorModel,
  onRunDetailAction,
  onOpenActivation,
  statusLoading,
  auditContent,
  secondaryActions,
  historyModel,
  selectedInstance,
  onLoadProvisioningRun,
}: InstanceDetailDoctorSectionProps) => (
  <div className="min-w-0 space-y-5 break-words">
    <DoctorStepCard
      title={t('admin.instances.doctor.steps.overview.title')}
      subtitle={t('admin.instances.doctor.steps.overview.subtitle')}
    >
      <ul data-testid="instance-doctor-overview" className="m-0 grid list-none gap-3 p-0">
        {[...doctorModel.checks]
          .sort((a, b) => Number(a.status === 'ready') - Number(b.status === 'ready'))
          .map((check) => (
            <li key={check.key} className="rounded-xl border border-border/70 bg-background/85 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{check.title}</div>
                  <p className="text-sm text-muted-foreground">{check.summary}</p>
                </div>
                <TenantIamStatusBadge status={check.status} />
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  {t('admin.instances.wizard.technicalDetails')}
                </summary>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{check.sourceLabel}</span>
                  {check.serviceIdentity ? (
                    <span>
                      {t('admin.instances.doctor.serviceIdentity', {
                        value: check.serviceIdentity,
                      })}
                    </span>
                  ) : null}
                  {check.classificationLabel ? (
                    <span>
                      {t('admin.instances.doctor.classification', {
                        value: check.classificationLabel,
                      })}
                    </span>
                  ) : null}
                  {check.checkedAt ? <span>{formatDateTime(check.checkedAt)}</span> : null}
                  {check.requestId ? (
                    <span>
                      {t('admin.instances.tenantIam.requestId', { value: check.requestId })}
                    </span>
                  ) : null}
                </div>
              </details>
              {check.remediation ? (
                <p className="mt-3 text-sm text-foreground">{check.remediation}</p>
              ) : null}
            </li>
          ))}
      </ul>
    </DoctorStepCard>

    <DoctorStepCard
      title={t('admin.instances.doctor.steps.recommendation.title')}
      subtitle={t('admin.instances.doctor.steps.recommendation.subtitle')}
    >
      <div className="rounded-xl border border-border/70 bg-background/85 p-4">
        <div className="space-y-1">
          <div className="text-lg font-semibold text-foreground">
            {doctorModel.recommendedAction.label}
          </div>
          <p className="text-sm text-muted-foreground">{doctorModel.recommendedAction.summary}</p>
          {doctorModel.recommendedAction.action === 'activate_instance' ? (
            <Button
              className="max-w-full whitespace-normal"
              type="button"
              variant="secondary"
              onClick={onOpenActivation}
            >
              {t('admin.instances.doctor.openActivation')}
            </Button>
          ) : onRunDetailAction ? (
            <Button
              className="max-w-full whitespace-normal"
              type="button"
              disabled={statusLoading}
              onClick={() => void onRunDetailAction(doctorModel.recommendedAction.action)}
            >
              {doctorModel.recommendedAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </DoctorStepCard>

    {onRunDetailAction && secondaryActions?.length ? (
      <details>
        <summary className="cursor-pointer text-sm">
          {t('admin.instances.wizard.technicalDetails')}
        </summary>
        <div className="flex flex-wrap gap-2">
          {secondaryActions
            .filter((action) => action.action !== doctorModel.recommendedAction.action)
            .map((action) => (
              <Button
                key={action.action}
                type="button"
                variant="secondary"
                disabled={statusLoading}
                onClick={() => void onRunDetailAction(action.action)}
              >
                {action.label}
              </Button>
            ))}
        </div>
      </details>
    ) : null}
    <DoctorStepCard
      title={t('admin.instances.doctor.steps.validation.title')}
      subtitle={t('admin.instances.doctor.steps.validation.subtitle')}
    >
      <div className="rounded-xl border border-border/70 bg-background/85 p-4">
        <p className="text-sm text-muted-foreground">
          {t(`admin.instances.doctor.validation.${doctorModel.validationState}`)}
        </p>
        {onRunDetailAction ? (
          <Button
            className="max-w-full whitespace-normal"
            type="button"
            variant="secondary"
            disabled={statusLoading}
            onClick={() => void onRunDetailAction('refresh_readiness')}
          >
            {t('admin.instances.actions.refreshReadiness')}
          </Button>
        ) : null}
      </div>
    </DoctorStepCard>

    {auditContent ? (
      <details>
        <summary className="cursor-pointer font-medium">
          {t('admin.instances.doctor.auditResults')}
        </summary>
        {auditContent}
      </details>
    ) : null}
    <details>
      <summary className="cursor-pointer font-medium">
        {t('admin.instances.doctor.historyTitle')}
      </summary>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {t('admin.instances.doctor.historySubtitle')}
        </p>
      </div>

      {historyModel?.hasHistoricalMismatchHint ? (
        <Alert>
          <AlertDescription>{t('admin.instances.history.mismatchHint')}</AlertDescription>
        </Alert>
      ) : null}

      <InstanceDetailHistorySection
        selectedInstance={{
          ...selectedInstance,
          keycloakProvisioningRuns: historyModel?.currentRun
            ? [historyModel.currentRun, ...historyModel.historicalRuns]
            : (historyModel?.historicalRuns ?? selectedInstance.keycloakProvisioningRuns),
        }}
        onLoadProvisioningRun={onLoadProvisioningRun}
      />
    </details>
  </div>
);
