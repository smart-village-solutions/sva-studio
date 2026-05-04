import * as React from 'react';

import reportData from './data/project-status.json';
import { validateProjectStatusReport, type ProjectHealth, type ProjectPriority, type ProjectStatus } from './lib/project-status';
import { t } from './lib/i18n';
import { createProjectReportModel, type ProjectStatusReport } from './lib/report-model';
import {
  parseFilterStateFromSearchParams,
  stringifyFilterStateToSearchParams,
  type ReportFilterState,
  type ReportView,
} from './lib/url-state';

const validationErrors = validateProjectStatusReport(reportData);

if (validationErrors.length > 0) {
  throw new Error(`Invalid project report fixture:\n${validationErrors.join('\n')}`);
}

const projectReport = reportData as ProjectStatusReport;

const healthClassNameByValue: Record<ProjectHealth, string> = {
  on_track: 'status-pill status-pill--on-track',
  needs_attention: 'status-pill status-pill--needs-attention',
  at_risk: 'status-pill status-pill--at-risk',
  blocked: 'status-pill status-pill--blocked',
};

const getStatusLabel = (status: ProjectStatus): string => {
  const statusKey = `app.statuses.${status}` as const;
  return t(statusKey);
};

const viewTabs: readonly { value: ReportView; label: string }[] = [
  { value: 'milestones', label: t('app.tabs.milestones') },
  { value: 'work-packages', label: t('app.tabs.workPackages') },
] as const;

const subscribeToLocation = (onStoreChange: () => void) => {
  globalThis.addEventListener('popstate', onStoreChange);
  return () => globalThis.removeEventListener('popstate', onStoreChange);
};

const readLocationSearch = () => globalThis.location.search;

const useFilterState = (): [ReportFilterState, (updater: (current: ReportFilterState) => ReportFilterState) => void] => {
  const locationSearch = React.useSyncExternalStore(subscribeToLocation, readLocationSearch, () => '');
  const filterState = React.useMemo(
    () => parseFilterStateFromSearchParams(new URLSearchParams(locationSearch)),
    [locationSearch]
  );

  const updateState = React.useCallback((updater: (current: ReportFilterState) => ReportFilterState) => {
    const nextState = updater(parseFilterStateFromSearchParams(new URLSearchParams(globalThis.location.search)));
    const params = stringifyFilterStateToSearchParams(nextState);
    const search = params.toString();
    const nextUrl = search.length > 0 ? `${globalThis.location.pathname}?${search}` : globalThis.location.pathname;
    globalThis.history.pushState({}, '', nextUrl);
    globalThis.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return [filterState, updateState];
};

const ProgressBar = ({ value }: Readonly<{ value: number }>) => (
  <div
    className="progress-shell"
    style={{ '--progress-width': value } as React.CSSProperties & { '--progress-width': number }}
    aria-label={`${t('app.milestone.progress')}: ${value}%`}
  />
);

const FilterSelect = ({
  label,
  value,
  options,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange: (value: string) => void;
}>) => (
  <label className="field">
    <span className="field__label">{label}</span>
    <select className="field__control" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const WorkPackageTable = ({
  rows,
}: Readonly<{
  rows: ReturnType<typeof createProjectReportModel>['workPackages'];
}>) => (
  <div className="table-shell">
    <table className="report-table">
      <thead>
        <tr>
          <th>{t('app.workPackageTable.id')}</th>
          <th>{t('app.workPackageTable.title')}</th>
          <th>{t('app.workPackageTable.milestone')}</th>
          <th>{t('app.workPackageTable.priority')}</th>
          <th>{t('app.workPackageTable.status')}</th>
          <th>{t('app.workPackageTable.health')}</th>
          <th>{t('app.workPackageTable.effort')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((entry) => (
          <>
            <tr key={`progress-${entry.id}`} className="table-row-progress">
              <td colSpan={7}>
                <ProgressBar value={entry.progressPercent} />
              </td>
            </tr>
            <tr key={entry.id}>
              <td>{entry.id}</td>
              <td>
                <strong>{entry.title}</strong>
                <div className="table-secondary">{entry.area}</div>
              </td>
              <td>{entry.milestoneTitle}</td>
              <td>{entry.priorityLabel}</td>
              <td>{getStatusLabel(entry.status)}</td>
              <td>
                {entry.health !== 'on_track' && (
                  <span className={healthClassNameByValue[entry.health]}>{entry.health}</span>
                )}
              </td>
              <td>{entry.effortPt}</td>
            </tr>
          </>
        ))}
      </tbody>
    </table>
  </div>
);

export function App() {
  const [filters, updateFilters] = useFilterState();

  const model = React.useMemo(() => createProjectReportModel(projectReport, filters), [filters]);

  const handleFilterChange = <TKey extends keyof ReportFilterState>(key: TKey, value: ReportFilterState[TKey]) => {
    updateFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">SVA Studio Meta View</p>
          <h1>{t('app.title')}</h1>
          <p className="hero__subtitle">{t('app.subtitle')}</p>
        </div>
        <dl className="hero__meta">
          <div>
            <dt>{t('app.updatedAt')}</dt>
            <dd>{projectReport.meta.updatedAt}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="tabs" role="tablist" aria-label={t('app.title')}>
          {viewTabs.map((tab) => {
            const selected = filters.view === tab.value;
            return (
              <button
                key={tab.value}
                className={selected ? 'tab-button tab-button--active' : 'tab-button'}
                role="tab"
                aria-selected={selected}
                onClick={() => handleFilterChange('view', tab.value)}
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="filter-grid">
          <label className="field field--search">
            <span className="field__label">{t('app.filters.search')}</span>
            <input
              className="field__control"
              type="search"
              value={filters.q}
              placeholder={t('app.filters.searchPlaceholder')}
              onChange={(event) => handleFilterChange('q', event.target.value)}
            />
          </label>
          <FilterSelect
            label={t('app.filters.milestone')}
            value={filters.milestone}
            options={model.availableMilestones}
            onChange={(value) => handleFilterChange('milestone', value)}
          />
          <FilterSelect
            label={t('app.filters.health')}
            value={filters.health}
            options={model.availableHealthStates}
            onChange={(value) => handleFilterChange('health', value as ProjectHealth | 'all')}
          />
          <FilterSelect
            label={t('app.filters.priority')}
            value={filters.priority}
            options={model.availablePriorities}
            onChange={(value) => handleFilterChange('priority', value as ProjectPriority | 'all')}
          />
        </div>
      </section>

      {filters.view === 'milestones' ? (
        <section className="milestone-grid">
          {model.milestones.length === 0 ? (
            <p className="empty-state">{t('app.emptyState')}</p>
          ) : (
            model.milestones.map((entry) => (
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
            ))
          )}
        </section>
      ) : model.workPackages.length === 0 ? (
        <p className="empty-state">{t('app.emptyState')}</p>
      ) : (
        <WorkPackageTable rows={model.workPackages} />
      )}
    </main>
  );
}
