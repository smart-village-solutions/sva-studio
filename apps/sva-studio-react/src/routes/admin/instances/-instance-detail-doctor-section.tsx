import type { ReactNode } from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { t } from '../../../i18n';
import { InstanceDetailHistorySection } from './-instance-detail-history-section';
import { TenantIamStatusBadge, formatDateTime } from './-instance-detail-view-shared';

import type { HistoryWorkspaceModel } from './-instance-detail-operations-types';
import type { DetailWorkflowAction, SelectedInstance } from './-instances-shared-types';
import type { InstanceDoctorModel } from './-instance-detail-doctor-model';

type InstanceDetailDoctorSectionProps = {
  readonly doctorModel: InstanceDoctorModel;
  readonly historyModel: HistoryWorkspaceModel | null;
  readonly selectedInstance: SelectedInstance;
  readonly statusLoading: boolean;
  readonly onRunDetailAction: (action: DetailWorkflowAction | 'focus_configuration') => Promise<void>;
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
  historyModel,
  selectedInstance,
  statusLoading,
  onRunDetailAction,
  onLoadProvisioningRun,
}: InstanceDetailDoctorSectionProps) => (
  <div className="space-y-5">
    <DoctorStepCard
      title={t('admin.instances.doctor.steps.overview.title')}
      subtitle={t('admin.instances.doctor.steps.overview.subtitle')}
    >
      <div data-testid="instance-doctor-overview" className="grid gap-3">
        {doctorModel.checks.map((check) => (
          <div key={check.key} className="rounded-xl border border-border/70 bg-background/85 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-medium text-foreground">{check.title}</div>
                <p className="text-sm text-muted-foreground">{check.summary}</p>
              </div>
              <TenantIamStatusBadge status={check.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{check.sourceLabel}</span>
              {check.checkedAt ? <span>{formatDateTime(check.checkedAt)}</span> : null}
              {check.requestId ? <span>{t('admin.instances.tenantIam.requestId', { value: check.requestId })}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </DoctorStepCard>

    <DoctorStepCard
      title={t('admin.instances.doctor.steps.recommendation.title')}
      subtitle={t('admin.instances.doctor.steps.recommendation.subtitle')}
    >
      <div className="rounded-xl border border-border/70 bg-background/85 p-4">
        <div className="space-y-1">
          <div className="text-lg font-semibold text-foreground">{doctorModel.recommendedAction.label}</div>
          <p className="text-sm text-muted-foreground">{doctorModel.recommendedAction.summary}</p>
        </div>
      </div>
    </DoctorStepCard>

    <DoctorStepCard
      title={t('admin.instances.doctor.steps.repair.title')}
      subtitle={t('admin.instances.doctor.steps.repair.subtitle')}
    >
      <div className="flex flex-wrap gap-2">
        {doctorModel.repairActions.map((action, index) => (
          <Button
            key={action.action}
            type="button"
            variant={index === 0 ? 'default' : 'outline'}
            onClick={() => void onRunDetailAction(action.action)}
            disabled={statusLoading}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </DoctorStepCard>

    <DoctorStepCard
      title={t('admin.instances.doctor.steps.validation.title')}
      subtitle={t('admin.instances.doctor.steps.validation.subtitle')}
    >
      <div className="rounded-xl border border-border/70 bg-background/85 p-4">
        <p className="text-sm text-muted-foreground">{t(`admin.instances.doctor.validation.${doctorModel.validationState}`)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {doctorModel.validationActions.map((action) => (
            <Button
              key={action.action}
              type="button"
              variant="outline"
              onClick={() => void onRunDetailAction(action.action)}
              disabled={statusLoading}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </DoctorStepCard>

    <div className="space-y-2">
      <div className="font-medium text-foreground">{t('admin.instances.doctor.historyTitle')}</div>
      <p className="text-sm text-muted-foreground">{t('admin.instances.doctor.historySubtitle')}</p>
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
          : historyModel?.historicalRuns ?? selectedInstance.keycloakProvisioningRuns,
      }}
      onLoadProvisioningRun={onLoadProvisioningRun}
    />
  </div>
);
