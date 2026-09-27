import { Button } from '@sva/studio-ui-react';
import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import { WorkflowStatusBadge } from './-instance-status-badges';
import { formatDateTime, type CockpitSectionProps } from './-instance-detail-view-shared';

export const InstanceDetailCockpitSection = ({
  selectedInstance,
  cockpitModel,
  onRunDetailAction,
  statusLoading,
}: CockpitSectionProps) => {
  const currentStep =
    cockpitModel.setupSteps.find((step) => step.status === 'current') ??
    cockpitModel.setupSteps.find((step) => step.status === 'blocked');
  const plan = selectedInstance.keycloakPlan;
  return (
    <Card className="space-y-4 p-4">
      <h2 id="instance-setup-heading" tabIndex={-1} className="text-lg font-semibold">
        {t('admin.instances.cockpit.setup.title')}
      </h2>
      <ol
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5"
        aria-label={t('admin.instances.cockpit.setup.ariaLabel')}
      >
        {cockpitModel.setupSteps.map((step, index) => (
          <li
            key={step.key}
            aria-current={step.key === currentStep?.key ? 'step' : undefined}
            className="flex flex-wrap items-center gap-2 border-b border-border py-2 text-sm"
          >
            <span>
              {index + 1}. {step.title}
            </span>
            <WorkflowStatusBadge status={step.status} />
          </li>
        ))}
      </ol>
      <section className="space-y-3" aria-live="polite">
        <h3 id="instance-current-task" tabIndex={-1} className="font-semibold">
          {currentStep?.title ?? cockpitModel.overallTitle}
        </h3>
        <p className="text-sm">{cockpitModel.overallSummary}</p>
        <ul
          className="flex flex-wrap gap-3"
          aria-label={t('admin.instances.cockpit.setup.technical.title')}
        >
          {cockpitModel.technicalProgress.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              {item.title}
              <WorkflowStatusBadge status={item.status} />
            </li>
          ))}
        </ul>
        {plan && cockpitModel.primaryAction.action === 'execute_provisioning' ? (
          <div className="space-y-2">
            <p className="text-sm">{plan.driftSummary}</p>
            <ul className="list-inside list-disc text-sm">
              {plan.steps
                .filter((step) => step.action === 'create' || step.action === 'update')
                .map((step) => (
                  <li key={step.stepKey}>
                    {step.title}: {step.summary}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
        <Button
          type="button"
          className="max-w-full whitespace-normal"
          disabled={statusLoading}
          onClick={() => void onRunDetailAction(cockpitModel.primaryAction.action)}
        >
          {cockpitModel.primaryAction.label}
        </Button>
      </section>
      {cockpitModel.anomalyQueue.length > 0 ? (
        <ul className="space-y-2" aria-label={t('admin.instances.cockpit.anomaliesTitle')}>
          {cockpitModel.anomalyQueue.map((item) => (
            <li key={item.key} className="border-l-2 border-border pl-3 text-sm">
              <span className="font-medium">{item.title}</span>
              <p>{item.summary}</p>
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  {t('admin.instances.wizard.technicalDetails')}
                </summary>
                <p>{item.sourceLabel}</p>
                {item.checkedAt ? <p>{formatDateTime(item.checkedAt)}</p> : null}
                {item.requestId ? (
                  <p className="break-all">
                    {t('admin.instances.tenantIam.requestId', { value: item.requestId })}
                  </p>
                ) : null}
              </details>
            </li>
          ))}
        </ul>
      ) : null}
      <details className="space-y-3">
        <summary className="cursor-pointer text-sm font-medium">
          {t('admin.instances.wizard.technicalDetails')}
        </summary>
        {plan ? (
          <div className="space-y-2 text-sm">
            <p className="break-all">{plan.fingerprint}</p>
            <p>{formatDateTime(plan.generatedAt)}</p>
            <ul>
              {plan.steps.map((step) => (
                <li key={step.stepKey}>
                  {step.title}: {step.summary}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs">
          {cockpitModel.dominantEvidence.sourceLabel} ·{' '}
          {formatDateTime(cockpitModel.dominantEvidence.checkedAt)}
        </p>
        <div className="flex flex-wrap gap-2">
          {cockpitModel.secondaryActions.map((action) => (
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
    </Card>
  );
};
