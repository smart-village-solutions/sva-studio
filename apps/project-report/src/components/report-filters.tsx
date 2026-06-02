import type { ProjectPriority, ProjectStatus } from '../lib/project-status';
import type { ProjectReportModel } from '../lib/report-model';
import type { ReportFilterState } from '../lib/url-state';
import { t } from '../lib/i18n';
import { FilterSelect } from './filter-select';

export const ReportFilters = ({
  filters,
  model,
  onChange,
}: Readonly<{
  filters: ReportFilterState;
  model: ProjectReportModel;
  onChange: <TKey extends keyof ReportFilterState>(key: TKey, value: ReportFilterState[TKey]) => void;
}>) => (
  <div className="filter-grid">
    <label className="field field--search">
      <span className="field__label">{t('app.filters.search')}</span>
      <input
        className="field__control"
        type="search"
        value={filters.q}
        placeholder={t('app.filters.searchPlaceholder')}
        onChange={(event) => onChange('q', event.target.value)}
      />
    </label>
    <FilterSelect
      label={t('app.filters.milestone')}
      value={filters.milestone}
      options={model.availableMilestones}
      onChange={(value) => onChange('milestone', value)}
    />
    <FilterSelect
      label={t('app.filters.status')}
      value={filters.status}
      options={model.availableStatuses}
      onChange={(value) => onChange('status', value as ProjectStatus | 'all')}
    />
    <FilterSelect
      label={t('app.filters.priority')}
      value={filters.priority}
      options={model.availablePriorities}
      onChange={(value) => onChange('priority', value as ProjectPriority | 'all')}
    />
  </div>
);
