import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import { getStatusGuidance } from './-instance-detail-models';
import { ConfigurationStatusBadge } from './-instance-status-badges';
import {
  COCKPIT_STATUS_STYLES,
  formatDateTime,
  INSTANCE_STATUS_LABELS,
  TenantIamStatusBadge,
} from './-instance-detail-view-shared';

import type { CockpitSectionProps } from './-instance-detail-view-shared';

const CockpitMetrics = ({
  selectedInstance,
  configurationAssessment,
  overallStatus,
  overallTitle,
  overallSummary,
}: Pick<CockpitSectionProps, 'selectedInstance' | 'configurationAssessment'> & {
  overallStatus: CockpitSectionProps['cockpitModel']['overallStatus'];
  overallTitle: string;
  overallSummary: string;
}) => (
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
    <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.instances.cockpit.identity')}</div>
      <div className="mt-3 space-y-1">
        <div className="text-lg font-semibold text-foreground">{selectedInstance.displayName}</div>
        <div className="text-sm text-muted-foreground">{selectedInstance.instanceId}</div>
        <div className="text-sm text-muted-foreground">
          {t('admin.instances.detail.primaryHostname', { value: selectedInstance.primaryHostname })}
        </div>
      </div>
    </div>

    <div className={`rounded-2xl border p-4 shadow-sm ${COCKPIT_STATUS_STYLES[overallStatus]}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{t('admin.instances.cockpit.currentState')}</div>
      <div className="mt-3 space-y-2">
        <div className="text-lg font-semibold">{overallTitle}</div>
        <p className="text-sm opacity-90">{overallSummary}</p>
      </div>
    </div>

    <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {t('admin.instances.cockpit.configurationSnapshot')}
      </div>
      {configurationAssessment ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-foreground">{configurationAssessment.title}</div>
            <ConfigurationStatusBadge status={configurationAssessment.overallStatus} />
          </div>
          <div className="text-sm text-muted-foreground">
            {t('admin.instances.configuration.labels.requirementsValue', {
              satisfied: configurationAssessment.satisfiedRequirements,
              total: configurationAssessment.totalRequirements,
            })}
          </div>
        </div>
      ) : null}
    </div>

    <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.instances.cockpit.lifecycle')}</div>
      <div className="mt-3 space-y-1">
        <div className="text-lg font-semibold text-foreground">{t(INSTANCE_STATUS_LABELS[selectedInstance.status])}</div>
        <div className="text-sm text-muted-foreground">
          {t('admin.instances.detail.parentDomain', { value: selectedInstance.parentDomain })}
        </div>
      </div>
    </div>
  </div>
);

const PrimaryActionsCard = ({
  cockpitModel,
  onRunDetailAction,
  statusLoading,
}: Pick<CockpitSectionProps, 'cockpitModel' | 'onRunDetailAction' | 'statusLoading'>) => (
  <div className="w-full max-w-md rounded-2xl border border-border/70 bg-background/95 p-4 shadow-lg shadow-slate-200/70">
    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
      {t('admin.instances.cockpit.primaryAction')}
    </div>
    <div className="mt-3 space-y-3">
      <div className="text-lg font-semibold text-foreground">{t('admin.instances.cockpit.primaryActionTitle')}</div>
      <p className="text-sm text-muted-foreground">{cockpitModel.overallSummary}</p>
      <Button
        type="button"
        className="w-full"
        onClick={() => void onRunDetailAction(cockpitModel.primaryAction.action)}
        disabled={statusLoading}
      >
        {cockpitModel.primaryAction.label}
      </Button>
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('admin.instances.cockpit.secondaryActions')}
        </div>
        <div className="flex flex-wrap gap-2">
          {cockpitModel.secondaryActions.map((action) => (
            <Button
              key={action.action}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onRunDetailAction(action.action)}
              disabled={statusLoading}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const AnomalyQueueCard = ({ cockpitModel }: Pick<CockpitSectionProps, 'cockpitModel'>) => (
  <div className="rounded-2xl border border-border/60 bg-background/85 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-foreground">{t('admin.instances.cockpit.anomaliesTitle')}</div>
        <p className="text-sm text-muted-foreground">{t('admin.instances.cockpit.anomaliesSubtitle')}</p>
      </div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{cockpitModel.anomalyQueue.length} / 3</div>
    </div>
    <div className="mt-4 grid gap-3">
      {cockpitModel.anomalyQueue.length > 0 ? (
        cockpitModel.anomalyQueue.map((item) => (
          <div
            key={item.key}
            className="rounded-2xl border border-border/60 bg-muted/20 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-foreground">{item.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
              </div>
              <TenantIamStatusBadge status={item.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{item.sourceLabel}</span>
              {item.checkedAt ? (
                <span>{t('admin.instances.cockpit.checkedAt', { value: formatDateTime(item.checkedAt) })}</span>
              ) : null}
              {item.requestId ? (
                <span>{t('admin.instances.tenantIam.requestId', { value: item.requestId })}</span>
              ) : null}
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
          {t('admin.instances.cockpit.anomaliesEmpty')}
        </div>
      )}
    </div>
  </div>
);

const EvidenceCard = ({
  selectedInstance,
  cockpitModel,
  mutationError,
}: Pick<CockpitSectionProps, 'selectedInstance' | 'cockpitModel' | 'mutationError'>) => (
  <div className="rounded-2xl border border-border/60 bg-background/85 p-4">
    <div className="text-sm font-semibold text-foreground">{t('admin.instances.cockpit.evidenceTitle')}</div>
    <p className="mt-1 text-sm text-muted-foreground">{t('admin.instances.cockpit.evidenceSubtitle')}</p>
    <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{cockpitModel.dominantEvidence.label}</div>
      <div className="mt-2 text-lg font-semibold text-foreground">{cockpitModel.dominantEvidence.sourceLabel}</div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        {cockpitModel.dominantEvidence.checkedAt ? (
          <div>{t('admin.instances.cockpit.checkedAt', { value: formatDateTime(cockpitModel.dominantEvidence.checkedAt) })}</div>
        ) : (
          <div>{t('admin.instances.cockpit.noEvidenceTimestamp')}</div>
        )}
        {cockpitModel.dominantEvidence.requestId ? (
          <div>{t('admin.instances.tenantIam.requestId', { value: cockpitModel.dominantEvidence.requestId })}</div>
        ) : null}
      </div>
    </div>
    <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div className="text-sm font-medium text-foreground">{getStatusGuidance(selectedInstance).title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{getStatusGuidance(selectedInstance).body}</p>
    </div>
    {mutationError?.code === 'keycloak_unavailable' ? (
      <div className="mt-4 rounded-md border border-border p-3 text-sm text-muted-foreground">
        {t('admin.instances.guidance.keycloakUnavailable')}
      </div>
    ) : null}
  </div>
);

export const InstanceDetailCockpitSection = ({
  selectedInstance,
  configurationAssessment,
  cockpitModel,
  mutationError,
  onRunDetailAction,
  statusLoading,
}: CockpitSectionProps) => (
  <Card className="overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(30,41,59,0.08),transparent_38%),linear-gradient(135deg,rgba(248,250,252,0.98),rgba(241,245,249,0.92))] p-0">
    <div className="space-y-6 p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {t('admin.instances.cockpit.eyebrow')}
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{t('admin.instances.cockpit.title')}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('admin.instances.cockpit.subtitle')}</p>
            </div>
          </div>
          <CockpitMetrics
            selectedInstance={selectedInstance}
            configurationAssessment={configurationAssessment}
            overallStatus={cockpitModel.overallStatus}
            overallTitle={cockpitModel.overallTitle}
            overallSummary={cockpitModel.overallSummary}
          />
        </div>
        <PrimaryActionsCard cockpitModel={cockpitModel} onRunDetailAction={onRunDetailAction} statusLoading={statusLoading} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <AnomalyQueueCard cockpitModel={cockpitModel} />
        <EvidenceCard selectedInstance={selectedInstance} cockpitModel={cockpitModel} mutationError={mutationError} />
      </div>
    </div>
  </Card>
);
