import * as React from 'react';

import reportData from './data/project-status.json';
import { getEditableWorkPackageOptions, isLocalProjectStatusHost, updateWorkPackageAssignment } from './lib/local-editing';
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
const localProjectStatusUrl = '/__local/project-status';
const localProjectStatusWorkPackageUrl = '/__local/project-status/work-package';

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

type LocalProjectStatusPatchRequest = Readonly<{
  workPackageId: string;
  milestoneId: string;
  priority: ProjectPriority;
  status: ProjectStatus;
}>;

const parseProjectStatusReport = (value: unknown): ProjectStatusReport => {
  const validationErrors = validateProjectStatusReport(value);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid project report payload:\n${validationErrors.join('\n')}`);
  }

  return value as ProjectStatusReport;
};

const loadLocalProjectStatusReport = async (): Promise<ProjectStatusReport> => {
  const response = await fetch(localProjectStatusUrl);

  if (!response.ok) {
    throw new Error(`Failed to load local project status: ${response.status}`);
  }

  return parseProjectStatusReport(await response.json());
};

const saveLocalProjectStatusUpdate = async (
  payload: LocalProjectStatusPatchRequest
): Promise<ProjectStatusReport> => {
  const response = await fetch(localProjectStatusWorkPackageUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to save local project status: ${response.status}`);
  }

  const body = (await response.json()) as {
    report?: unknown;
  };

  return parseProjectStatusReport(body.report);
};

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
  isLocalEditingEnabled,
  isSaving,
  editableMilestones,
  editableStatuses,
  editablePriorities,
  onUpdateWorkPackage,
}: Readonly<{
  rows: ReturnType<typeof createProjectReportModel>['workPackages'];
  isLocalEditingEnabled: boolean;
  isSaving: boolean;
  editableMilestones: readonly { id: string; label: string }[];
  editableStatuses: readonly { id: ProjectStatus }[];
  editablePriorities: readonly { id: ProjectPriority }[];
  onUpdateWorkPackage: (payload: LocalProjectStatusPatchRequest) => void;
}>) => {
  const [expandedRows, setExpandedRows] = React.useState<ReadonlySet<string>>(() => new Set());

  const toggleRow = React.useCallback((id: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
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
          {rows.map((entry) => {
            const isExpanded = expandedRows.has(entry.id);
            const detailId = `work-package-summary-${entry.id}`;
            const hasFeatureSummary = typeof entry.featureSummary === 'string' && entry.featureSummary.trim().length > 0;
            const detailToggleLabel = isExpanded
              ? t('app.workPackageTable.hideDetails')
              : t('app.workPackageTable.showDetails');

            return (
              <React.Fragment key={entry.id}>
                <tr className="table-row-progress">
                  <td colSpan={7}>
                    <ProgressBar value={entry.progressPercent} />
                  </td>
                </tr>
                <tr>
                  <td>{entry.id}</td>
                  <td>
                    <div className="table-title-row">
                      <strong>{entry.title}</strong>
                      {hasFeatureSummary && (
                        <button
                          type="button"
                          className="table-detail-toggle"
                          aria-expanded={isExpanded}
                          aria-controls={detailId}
                          aria-label={
                            isExpanded
                              ? t('app.workPackageTable.hideDetailsAriaLabel', { id: entry.id })
                              : t('app.workPackageTable.showDetailsAriaLabel', { id: entry.id })
                          }
                          onClick={() => toggleRow(entry.id)}
                        >
                          {detailToggleLabel}
                        </button>
                      )}
                    </div>
                    <div className="table-secondary">{entry.area}</div>
                  </td>
                  <td>
                    {isLocalEditingEnabled ? (
                      <select
                        className="table-inline-select"
                        aria-label={t('app.workPackageTable.editMilestoneAriaLabel', { id: entry.id })}
                        value={entry.milestoneId}
                        disabled={isSaving}
                        onChange={(event) =>
                          onUpdateWorkPackage({
                            workPackageId: entry.id,
                            milestoneId: event.target.value,
                            priority: entry.priority,
                            status: entry.status,
                          })
                        }
                      >
                        {editableMilestones.map((milestone) => (
                          <option key={milestone.id} value={milestone.id}>
                            {milestone.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      entry.milestoneTitle
                    )}
                  </td>
                  <td>
                    {isLocalEditingEnabled ? (
                      <select
                        className="table-inline-select"
                        aria-label={t('app.workPackageTable.editPriorityAriaLabel', { id: entry.id })}
                        value={entry.priority}
                        disabled={isSaving}
                        onChange={(event) =>
                          onUpdateWorkPackage({
                            workPackageId: entry.id,
                            milestoneId: entry.milestoneId,
                            priority: event.target.value as ProjectPriority,
                            status: entry.status,
                          })
                        }
                      >
                        {editablePriorities.map((priority) => (
                          <option key={priority.id} value={priority.id}>
                            {projectReport.priorityModel[priority.id]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      entry.priorityLabel
                    )}
                  </td>
                  <td>
                    {isLocalEditingEnabled ? (
                      <select
                        className="table-inline-select"
                        aria-label={t('app.workPackageTable.editStatusAriaLabel', { id: entry.id })}
                        value={entry.status}
                        disabled={isSaving}
                        onChange={(event) =>
                          onUpdateWorkPackage({
                            workPackageId: entry.id,
                            milestoneId: entry.milestoneId,
                            priority: entry.priority,
                            status: event.target.value as ProjectStatus,
                          })
                        }
                      >
                        {editableStatuses.map((status) => (
                          <option key={status.id} value={status.id}>
                            {getStatusLabel(status.id)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      getStatusLabel(entry.status)
                    )}
                  </td>
                  <td>
                    {entry.health !== 'on_track' && (
                      <span className={healthClassNameByValue[entry.health]}>{entry.health}</span>
                    )}
                  </td>
                  <td>{entry.effortPt}</td>
                </tr>
                {hasFeatureSummary && isExpanded && (
                  <tr className="table-detail-row" id={detailId}>
                    <td colSpan={7}>
                      <div className="table-detail-card">
                        <p className="table-detail-text">{entry.featureSummary}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export function App() {
  const [filters, updateFilters] = useFilterState();
  const [report, setReport] = React.useState<ProjectStatusReport>(projectReport);
  const [localEditingMessage, setLocalEditingMessage] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const isLocalEditingEnabled = React.useMemo(() => isLocalProjectStatusHost(globalThis.location.hostname), []);
  const confirmedReportRef = React.useRef(projectReport);

  const model = React.useMemo(() => createProjectReportModel(report, filters), [report, filters]);
  const editableOptions = React.useMemo(() => getEditableWorkPackageOptions(report), [report]);

  React.useEffect(() => {
    if (!isLocalEditingEnabled) {
      return;
    }

    let isDisposed = false;
    setLocalEditingMessage(t('app.localEditing.loading'));

    void loadLocalProjectStatusReport()
      .then((nextReport) => {
        if (isDisposed) {
          return;
        }

        confirmedReportRef.current = nextReport;
        setReport(nextReport);
        setLocalEditingMessage(t('app.localEditing.active'));
      })
      .catch(() => {
        if (isDisposed) {
          return;
        }

        setLocalEditingMessage(t('app.localEditing.loadError'));
      });

    return () => {
      isDisposed = true;
    };
  }, [isLocalEditingEnabled]);

  const handleFilterChange = <TKey extends keyof ReportFilterState>(key: TKey, value: ReportFilterState[TKey]) => {
    updateFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleLocalWorkPackageUpdate = React.useCallback(
    (payload: LocalProjectStatusPatchRequest) => {
      if (!isLocalEditingEnabled || isSaving) {
        return;
      }

      const previousReport = confirmedReportRef.current;
      const optimisticReport = updateWorkPackageAssignment(previousReport, payload);

      setIsSaving(true);
      setLocalEditingMessage(t('app.localEditing.active'));
      setReport(optimisticReport);

      void saveLocalProjectStatusUpdate(payload)
        .then((nextReport) => {
          confirmedReportRef.current = nextReport;
          setReport(nextReport);
          setLocalEditingMessage(t('app.localEditing.active'));
        })
        .catch(() => {
          confirmedReportRef.current = previousReport;
          setReport(previousReport);
          setLocalEditingMessage(t('app.localEditing.saveError'));
        })
        .finally(() => {
          setIsSaving(false);
        });
    },
    [isLocalEditingEnabled, isSaving]
  );

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
            <dd>{report.meta.updatedAt}</dd>
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
            label={t('app.filters.status')}
            value={filters.status}
            options={model.availableStatuses}
            onChange={(value) => handleFilterChange('status', value as ProjectStatus | 'all')}
          />
          <FilterSelect
            label={t('app.filters.priority')}
            value={filters.priority}
            options={model.availablePriorities}
            onChange={(value) => handleFilterChange('priority', value as ProjectPriority | 'all')}
          />
        </div>

        {isLocalEditingEnabled && localEditingMessage && (
          <p
            className={
              localEditingMessage === t('app.localEditing.saveError') || localEditingMessage === t('app.localEditing.loadError')
                ? 'panel-message panel-message--error'
                : 'panel-message panel-message--info'
            }
            role={
              localEditingMessage === t('app.localEditing.saveError') || localEditingMessage === t('app.localEditing.loadError')
                ? 'alert'
                : undefined
            }
          >
            {localEditingMessage}
          </p>
        )}
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
        <WorkPackageTable
          rows={model.workPackages}
          isLocalEditingEnabled={isLocalEditingEnabled}
          isSaving={isSaving}
          editableMilestones={editableOptions.milestones}
          editableStatuses={editableOptions.statuses}
          editablePriorities={editableOptions.priorities}
          onUpdateWorkPackage={handleLocalWorkPackageUpdate}
        />
      )}
    </main>
  );
}
