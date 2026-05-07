import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import { ProvisioningStepBadge } from './-instance-status-badges';
import { INSTANCE_STATUS_LABELS } from './-instance-detail-view-shared';

import type { HistorySectionProps } from './-instance-detail-view-shared';

export const InstanceDetailHistorySection = ({
  selectedInstance,
  onLoadProvisioningRun,
}: HistorySectionProps) => (
  <>
    <Card className="space-y-3 p-4">
      <div className="space-y-1">
        <div className="font-medium text-foreground">{t('admin.instances.flow.protocolTitle')}</div>
        <p className="text-xs text-muted-foreground">{t('admin.instances.flow.protocolSubtitle')}</p>
      </div>
      {selectedInstance.keycloakProvisioningRuns.length > 0 ? (
        selectedInstance.keycloakProvisioningRuns.map((run) => (
          <div key={run.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-foreground">{run.intent}</div>
                <div className="text-xs text-muted-foreground">
                  {run.mode} • {run.overallStatus} • {run.requestId ?? t('shell.runtimeHealth.notAvailable')}
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => void onLoadProvisioningRun(run.id)}>
                {t('admin.instances.actions.loadRun')}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{run.driftSummary}</p>
            <div className="mt-3 grid gap-2">
              {run.steps.map((step) => (
                <div key={`${run.id}-${step.stepKey}`} className="rounded-md border border-border p-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">{step.title}</span>
                    <ProvisioningStepBadge status={step.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{step.summary}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">{t('admin.instances.flow.protocolEmpty')}</p>
      )}
    </Card>

    <Card className="space-y-2 p-4">
      <div className="font-medium text-foreground">{t('admin.instances.detail.runs')}</div>
      {selectedInstance.provisioningRuns.length > 0 ? (
        selectedInstance.provisioningRuns.map((run) => (
          <div key={run.id} className="rounded-lg border border-border p-3">
            <div className="font-medium">{run.operation}</div>
            <div className="text-muted-foreground">
              {t('admin.instances.detail.runStatus', { value: t(INSTANCE_STATUS_LABELS[run.status]) })}
            </div>
          </div>
        ))
      ) : (
        <p className="text-muted-foreground">{t('admin.instances.detail.noRuns')}</p>
      )}
    </Card>
  </>
);
