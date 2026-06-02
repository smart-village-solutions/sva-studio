import * as React from 'react';

import { ProjectReportPage } from './components/project-report-page';
import { useFilterState } from './hooks/use-filter-state';
import { useLocalProjectStatus } from './hooks/use-local-project-status';
import { projectReport } from './lib/project-report-fixture';
import { createProjectReportModel } from './lib/report-model';
import type { ReportFilterState } from './lib/url-state';

export function App() {
  const [filters, updateFilters] = useFilterState();
  const {
    editableOptions,
    isLocalEditingEnabled,
    isSaving,
    localEditingNotice,
    report,
    updateLocalWorkPackage,
  } = useLocalProjectStatus(projectReport);
  const model = React.useMemo(() => createProjectReportModel(report, filters), [report, filters]);
  const handleFilterChange = React.useCallback(
    function handleFilterChange<TKey extends keyof ReportFilterState>(key: TKey, value: ReportFilterState[TKey]) {
      updateFilters((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [updateFilters]
  );

  return (
    <ProjectReportPage
      filters={filters}
      model={model}
      report={report}
      editableOptions={editableOptions}
      isLocalEditingEnabled={isLocalEditingEnabled}
      isSaving={isSaving}
      localEditingNotice={localEditingNotice}
      onFilterChange={handleFilterChange}
      onUpdateWorkPackage={updateLocalWorkPackage}
    />
  );
}
