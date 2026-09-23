import { Button } from '@sva/studio-ui-react';
import { Card } from '../../../components/ui/card';
import { StudioSummaryCard } from '../../../components/StudioSummaryCard';
import { t } from '../../../i18n';
import { getStatusGuidance } from './-instance-detail-models';
import { ConfigurationStatusBadge, WorkflowStatusBadge } from './-instance-status-badges';
import {
  COCKPIT_STATUS_STYLES,
  formatDateTime,
  INSTANCE_STATUS_LABELS,
  TenantIamStatusBadge,
} from './-instance-detail-view-shared';

import type { CockpitSectionProps } from './-instance-detail-view-shared';

const SetupProgress = ({ cockpitModel }: Pick<CockpitSectionProps, 'cockpitModel'>) => (
  <ol
    className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
    aria-label={t('admin.instances.cockpit.setup.ariaLabel')}
  >
    {cockpitModel.setupSteps.map((step, index) => (
      <li
        key={step.key}
        aria-current={step.status === 'current' ? 'step' : undefined}
        className={`rounded-xl border p-3 ${
          step.status === 'current'
            ? 'border-foreground bg-accent/40'
            : step.status === 'blocked'
              ? 'border-destructive/40 bg-destructive/10'
              : 'border-border bg-background/80'
        }`}
      >
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{index + 1}</div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <span className="font-medium text-foreground">{step.title}</span>
          <WorkflowStatusBadge status={step.status} />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{step.description}</p>
      </li>
    ))}
  </ol>
);

const TechnicalProgress = ({ cockpitModel }: Pick<CockpitSectionProps, 'cockpitModel'>) => (
  <div className="rounded-xl border border-border/70 bg-background/80 p-4">
    <div className="text-sm font-semibold text-foreground">
      {t('admin.instances.cockpit.setup.technical.title')}
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {cockpitModel.technicalProgress.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
        >
          <span className="text-sm text-foreground">{item.title}</span>
          <WorkflowStatusBadge status={item.status} />
        </div>
      ))}
    </div>
  </div>
);

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
    <StudioSummaryCard
      eyebrow={t('admin.instances.cockpit.identity')}
      value={selectedInstance.displayName}
      valueClassName="text-lg"
    >
      <div className="space-y-1 text-sm text-muted-foreground">
        <div>{selectedInstance.instanceId}</div>
        <div>
          {t('admin.instances.detail.primaryHostname', { value: selectedInstance.primaryHostname })}
        </div>
      </div>
    </StudioSummaryCard>

    <StudioSummaryCard
      eyebrow={t('admin.instances.cockpit.currentState')}
      value={overallTitle}
      valueClassName="text-lg"
      description={overallSummary}
      className={COCKPIT_STATUS_STYLES[overallStatus]}
    />

    <StudioSummaryCard
      eyebrow={t('admin.instances.cockpit.configurationSnapshot')}
      value={
        configurationAssessment
          ? configurationAssessment.title
          : t('admin.instances.cockpit.configurationSnapshot')
      }
      valueClassName="text-base"
    >
      {configurationAssessment ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
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
    </StudioSummaryCard>

    <StudioSummaryCard
      eyebrow={t('admin.instances.cockpit.lifecycle')}
      value={t(INSTANCE_STATUS_LABELS[selectedInstance.status])}
      valueClassName="text-lg"
    >
      <div className="space-y-1 text-sm text-muted-foreground">
        <div>
          {t('admin.instances.detail.parentDomain', { value: selectedInstance.parentDomain })}
        </div>
      </div>
    </StudioSummaryCard>
  </div>
);

const PrimaryActionsCard = ({
  cockpitModel,
  onRunDetailAction,
  statusLoading,
}: Pick<CockpitSectionProps, 'cockpitModel' | 'onRunDetailAction' | 'statusLoading'>) => (
  <div className="w-full max-w-md rounded-lg border border-border/70 bg-background/95 p-4 shadow-shell">
    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
      {t('admin.instances.cockpit.primaryAction')}
    </div>
    <div className="mt-3 space-y-3">
      <div className="text-lg font-semibold text-foreground">
        {t('admin.instances.cockpit.primaryActionTitle')}
      </div>
      <p className="text-sm text-muted-foreground">{cockpitModel.overallSummary}</p>
      <Button
        type="button"
        className="w-full"
        onClick={() => void onRunDetailAction(cockpitModel.primaryAction.action)}
        disabled={statusLoading}
      >
        {cockpitModel.primaryAction.label}
      </Button>
      <details className="space-y-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('admin.instances.wizard.technicalDetails')}
        </summary>
        <div className="flex flex-wrap gap-2">
          {cockpitModel.secondaryActions.map((action) => (
            <Button
              key={action.action}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void onRunDetailAction(action.action)}
              disabled={statusLoading}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </details>
    </div>
  </div>
);

const AnomalyQueueCard = ({ cockpitModel }: Pick<CockpitSectionProps, 'cockpitModel'>) => (
  <div className="rounded-lg border border-border/70 bg-background/90 p-4 shadow-shell">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-foreground">
          {t('admin.instances.cockpit.anomaliesTitle')}
        </div>
        <p className="text-sm text-muted-foreground">
          {t('admin.instances.cockpit.anomaliesSubtitle')}
        </p>
      </div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {cockpitModel.anomalyQueue.length} / 3
      </div>
    </div>
    <div className="mt-4 grid gap-3">
      {cockpitModel.anomalyQueue.length > 0 ? (
        cockpitModel.anomalyQueue.map((item) => (
          <div
            key={item.key}
            className="rounded-lg border border-border/70 bg-muted/20 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
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
                <span>
                  {t('admin.instances.cockpit.checkedAt', {
                    value: formatDateTime(item.checkedAt),
                  })}
                </span>
              ) : null}
              {item.requestId ? (
                <span>{t('admin.instances.tenantIam.requestId', { value: item.requestId })}</span>
              ) : null}
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
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
  <div className="rounded-lg border border-border/70 bg-background/90 p-4 shadow-shell">
    <div className="text-sm font-semibold text-foreground">
      {t('admin.instances.cockpit.evidenceTitle')}
    </div>
    <p className="mt-1 text-sm text-muted-foreground">
      {t('admin.instances.cockpit.evidenceSubtitle')}
    </p>
    <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {cockpitModel.dominantEvidence.label}
      </div>
      <div className="mt-2 text-lg font-semibold text-foreground">
        {cockpitModel.dominantEvidence.sourceLabel}
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        {cockpitModel.dominantEvidence.checkedAt ? (
          <div>
            {t('admin.instances.cockpit.checkedAt', {
              value: formatDateTime(cockpitModel.dominantEvidence.checkedAt),
            })}
          </div>
        ) : (
          <div>{t('admin.instances.cockpit.noEvidenceTimestamp')}</div>
        )}
        {cockpitModel.dominantEvidence.requestId ? (
          <div>
            {t('admin.instances.tenantIam.requestId', {
              value: cockpitModel.dominantEvidence.requestId,
            })}
          </div>
        ) : null}
      </div>
    </div>
    <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="text-sm font-medium text-foreground">
        {getStatusGuidance(selectedInstance).title}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {getStatusGuidance(selectedInstance).body}
      </p>
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
  <Card className="overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(0,90,158,0.08),transparent_38%),linear-gradient(135deg,rgba(245,249,253,0.98),rgba(236,243,251,0.94))] p-0">
    <div className="space-y-6 p-5 md:p-6">
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {t('admin.instances.cockpit.setup.phase')}
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            {t('admin.instances.cockpit.setup.title')}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t('admin.instances.cockpit.setup.subtitle')}
          </p>
        </div>
      </div>

      <SetupProgress cockpitModel={cockpitModel} />
      <TechnicalProgress cockpitModel={cockpitModel} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.62fr)]">
        <div
          className={`rounded-xl border p-5 ${COCKPIT_STATUS_STYLES[cockpitModel.overallStatus]}`}
          aria-live="polite"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-75">
            {t('admin.instances.cockpit.currentState')}
          </div>
          <div className="mt-2 text-xl font-semibold">{cockpitModel.overallTitle}</div>
          <p className="mt-2 max-w-2xl text-sm">{cockpitModel.overallSummary}</p>
          <div className="mt-4 border-t border-current/15 pt-3 text-xs opacity-80">
            {selectedInstance.displayName} · {selectedInstance.primaryHostname}
          </div>
        </div>
        <PrimaryActionsCard
          cockpitModel={cockpitModel}
          onRunDetailAction={onRunDetailAction}
          statusLoading={statusLoading}
        />
      </div>

      <details className="rounded-xl border border-border/70 bg-background/70 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          {t('admin.instances.wizard.technicalDetails')}
        </summary>
        <div className="mt-4 space-y-4">
          <CockpitMetrics
            selectedInstance={selectedInstance}
            configurationAssessment={configurationAssessment}
            overallStatus={cockpitModel.overallStatus}
            overallTitle={cockpitModel.overallTitle}
            overallSummary={cockpitModel.overallSummary}
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <AnomalyQueueCard cockpitModel={cockpitModel} />
            <EvidenceCard
              selectedInstance={selectedInstance}
              cockpitModel={cockpitModel}
              mutationError={mutationError}
            />
          </div>
        </div>
      </details>
    </div>
  </Card>
);
