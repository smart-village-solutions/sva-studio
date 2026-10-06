import { Card } from '../../../components/ui/card';
import { t } from '../../../i18n';
import { ConfigurationStatusBadge } from './-instance-status-badges';
import {
  INSTANCE_STATUS_LABELS,
  type ConfigurationSectionProps,
} from './-instance-detail-view-shared';

const IssueList = ({ title, items }: { title: string; items: readonly string[] }) => (
  <div className="space-y-2">
    <div className="text-sm font-medium text-foreground">{title}</div>
    <ul className="space-y-1 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item}>• {item}</li>
      ))}
    </ul>
  </div>
);

export const ConfigurationAssessmentCard = ({
  configurationAssessment,
  selectedInstance,
}: Pick<ConfigurationSectionProps, 'configurationAssessment' | 'selectedInstance'>) =>
  configurationAssessment ? (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="font-medium text-foreground">
            {t('admin.instances.configuration.title')}
          </div>
          <p className="text-sm text-muted-foreground">{configurationAssessment.title}</p>
        </div>
        <ConfigurationStatusBadge status={configurationAssessment.overallStatus} />
      </div>
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.instances.configuration.labels.lifecycle')}
          </div>
          <div className="mt-1 font-medium text-foreground">
            {t(INSTANCE_STATUS_LABELS[selectedInstance.status])}
          </div>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('admin.instances.configuration.labels.requirements')}
          </div>
          <div className="mt-1 font-medium text-foreground">
            {t('admin.instances.configuration.labels.requirementsValue', {
              satisfied: configurationAssessment.satisfiedRequirements,
              total: configurationAssessment.totalRequirements,
            })}
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{configurationAssessment.body}</p>
      {configurationAssessment.blockingIssues.length > 0 ? (
        <IssueList
          title={t('admin.instances.configuration.labels.blockingIssues')}
          items={configurationAssessment.blockingIssues.map((issue) => issue.label)}
        />
      ) : null}
      {configurationAssessment.warningIssues.length > 0 ? (
        <IssueList
          title={t('admin.instances.configuration.labels.warnings')}
          items={configurationAssessment.warningIssues.map((issue) => issue.label)}
        />
      ) : null}
    </Card>
  ) : null;
