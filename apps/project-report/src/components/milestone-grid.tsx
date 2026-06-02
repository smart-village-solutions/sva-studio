import type { ProjectReportModel } from '../lib/report-model';
import { t } from '../lib/i18n';
import { ProgressBar } from './progress-bar';

export const MilestoneGrid = ({
  milestones,
}: Readonly<{
  milestones: ProjectReportModel['milestones'];
}>) => {
  if (milestones.length === 0) {
    return <p className="empty-state">{t('app.emptyState')}</p>;
  }

  return (
    <section className="milestone-grid">
      {milestones.map((entry) => (
        <article className="milestone-card" key={entry.id}>
          <div className="milestone-card__header">
            <div>
              <p className="milestone-card__id">{entry.id}</p>
              <h2>{entry.title}</h2>
            </div>
          </div>
          <ProgressBar value={entry.completionPercent} />
          <dl className="milestone-stats">
            <div>
              <dt>{t('app.milestone.progress')}</dt>
              <dd>{entry.completionPercent}%</dd>
            </div>
            <div>
              <dt>{t('app.milestone.estimatedEffort')}</dt>
              <dd>{entry.scheduledEffortPt}</dd>
            </div>
            <div>
              <dt>{t('app.milestone.workPackages')}</dt>
              <dd>{entry.workPackageCount}</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
};
