import type { EditableWorkPackageOptions } from '../lib/local-editing';
import { t } from '../lib/i18n';
import type { ProjectReportModel, ProjectStatusReport } from '../lib/report-model';
import type { LocalProjectStatusPatchRequest } from '../lib/project-status-api';
import type { ReportFilterState } from '../lib/url-state';
import type { LocalEditingNotice } from '../hooks/use-local-project-status';
import { LocalEditingMessage } from './local-editing-message';
import { MilestoneGrid } from './milestone-grid';
import { ReportFilters } from './report-filters';
import { ReportTabs } from './report-tabs';
import { WorkPackageTable } from './work-package-table';

const ReportHero = ({ updatedAt }: Readonly<{ updatedAt: string }>) => (
  <section className="hero">
    <div className="hero__content">
      <p className="hero__eyebrow">SVA Studio Meta View</p>
      <h1>{t('app.title')}</h1>
      <p className="hero__subtitle">{t('app.subtitle')}</p>
    </div>
    <dl className="hero__meta">
      <div>
        <dt>{t('app.updatedAt')}</dt>
        <dd>{updatedAt}</dd>
      </div>
    </dl>
  </section>
);

const ProjectReportContent = ({
  model,
  report,
  editableOptions,
  isLocalEditingEnabled,
  isSaving,
  filters,
  onUpdateWorkPackage,
}: Readonly<{
  model: ProjectReportModel;
  report: ProjectStatusReport;
  editableOptions: EditableWorkPackageOptions;
  isLocalEditingEnabled: boolean;
  isSaving: boolean;
  filters: ReportFilterState;
  onUpdateWorkPackage: (payload: LocalProjectStatusPatchRequest) => void;
}>) => {
  if (filters.view === 'milestones') {
    return <MilestoneGrid milestones={model.milestones} />;
  }

  if (model.workPackages.length === 0) {
    return <p className="empty-state">{t('app.emptyState')}</p>;
  }

  return (
    <WorkPackageTable
      rows={model.workPackages}
      isLocalEditingEnabled={isLocalEditingEnabled}
      isSaving={isSaving}
      editableMilestones={editableOptions.milestones}
      editableStatuses={editableOptions.statuses}
      editablePriorities={editableOptions.priorities}
      priorityLabels={report.priorityModel}
      onUpdateWorkPackage={onUpdateWorkPackage}
    />
  );
};

export const ProjectReportPage = ({
  filters,
  model,
  report,
  editableOptions,
  isLocalEditingEnabled,
  isSaving,
  localEditingNotice,
  onFilterChange,
  onUpdateWorkPackage,
}: Readonly<{
  filters: ReportFilterState;
  model: ProjectReportModel;
  report: ProjectStatusReport;
  editableOptions: EditableWorkPackageOptions;
  isLocalEditingEnabled: boolean;
  isSaving: boolean;
  localEditingNotice: LocalEditingNotice | null;
  onFilterChange: <TKey extends keyof ReportFilterState>(key: TKey, value: ReportFilterState[TKey]) => void;
  onUpdateWorkPackage: (payload: LocalProjectStatusPatchRequest) => void;
}>) => (
  <main className="page-shell">
    <ReportHero updatedAt={report.meta.updatedAt} />

    <section className="panel">
      <ReportTabs selectedView={filters.view} onChange={(view) => onFilterChange('view', view)} />
      <ReportFilters filters={filters} model={model} onChange={onFilterChange} />
      {isLocalEditingEnabled ? <LocalEditingMessage notice={localEditingNotice} /> : null}
    </section>

    <ProjectReportContent
      model={model}
      report={report}
      editableOptions={editableOptions}
      isLocalEditingEnabled={isLocalEditingEnabled}
      isSaving={isSaving}
      filters={filters}
      onUpdateWorkPackage={onUpdateWorkPackage}
    />
  </main>
);
