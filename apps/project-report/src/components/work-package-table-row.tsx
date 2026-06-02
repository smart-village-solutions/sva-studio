import * as React from 'react';

import type { EditableMilestoneOption, EditableValueOption } from '../lib/local-editing';
import { t } from '../lib/i18n';
import type { ProjectHealth, ProjectPriority, ProjectStatus } from '../lib/project-status';
import type { ProjectStatusReport, WorkPackageRow } from '../lib/report-model';
import type { LocalProjectStatusPatchRequest } from '../lib/project-status-api';
import { ProgressBar } from './progress-bar';
import {
  WorkPackageMilestoneCell,
  WorkPackagePriorityCell,
  WorkPackageStatusCell,
} from './work-package-table-editors';

const healthClassNameByValue: Record<ProjectHealth, string> = {
  on_track: 'status-pill status-pill--on-track',
  needs_attention: 'status-pill status-pill--needs-attention',
  at_risk: 'status-pill status-pill--at-risk',
  blocked: 'status-pill status-pill--blocked',
};

const WorkPackageDetailRow = ({ detailId, featureSummary }: Readonly<{ detailId: string; featureSummary: string }>) => (
  <tr className="table-detail-row" id={detailId}>
    <td colSpan={7}>
      <div className="table-detail-card">
        <p className="table-detail-text">{featureSummary}</p>
      </div>
    </td>
  </tr>
);

const WorkPackageTitleCell = ({
  area,
  detailId,
  hasFeatureSummary,
  id,
  isExpanded,
  title,
  onToggle,
}: Readonly<{
  area: string;
  detailId: string;
  hasFeatureSummary: boolean;
  id: string;
  isExpanded: boolean;
  title: string;
  onToggle: () => void;
}>) => {
  const toggleLabel = isExpanded ? t('app.workPackageTable.hideDetails') : t('app.workPackageTable.showDetails');

  return (
    <td>
      <div className="table-title-row">
        <strong>{title}</strong>
        {hasFeatureSummary ? (
          <button
            type="button"
            className="table-detail-toggle"
            aria-expanded={isExpanded}
            aria-controls={detailId}
            aria-label={
              isExpanded
                ? t('app.workPackageTable.hideDetailsAriaLabel', { id })
                : t('app.workPackageTable.showDetailsAriaLabel', { id })
            }
            onClick={onToggle}
          >
            {toggleLabel}
          </button>
        ) : null}
      </div>
      <div className="table-secondary">{area}</div>
    </td>
  );
};

export const WorkPackageTableRow = ({
  entry,
  isLocalEditingEnabled,
  isSaving,
  editableMilestones,
  editableStatuses,
  editablePriorities,
  priorityLabels,
  onUpdateWorkPackage,
}: Readonly<{
  entry: WorkPackageRow;
  isLocalEditingEnabled: boolean;
  isSaving: boolean;
  editableMilestones: readonly EditableMilestoneOption[];
  editableStatuses: readonly EditableValueOption<ProjectStatus>[];
  editablePriorities: readonly EditableValueOption<ProjectPriority>[];
  priorityLabels: ProjectStatusReport['priorityModel'];
  onUpdateWorkPackage: (payload: LocalProjectStatusPatchRequest) => void;
}>) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const detailId = `work-package-summary-${entry.id}`;
  const hasFeatureSummary = typeof entry.featureSummary === 'string' && entry.featureSummary.trim().length > 0;

  return (
    <React.Fragment>
      <tr className="table-row-progress">
        <td colSpan={7}>
          <ProgressBar value={entry.progressPercent} />
        </td>
      </tr>
      <tr>
        <td>{entry.id}</td>
        <WorkPackageTitleCell
          area={entry.area}
          detailId={detailId}
          hasFeatureSummary={hasFeatureSummary}
          id={entry.id}
          isExpanded={isExpanded}
          title={entry.title}
          onToggle={() => setIsExpanded((current) => !current)}
        />
        <WorkPackageMilestoneCell
          entry={entry}
          editableMilestones={editableMilestones}
          isLocalEditingEnabled={isLocalEditingEnabled}
          isSaving={isSaving}
          onUpdateWorkPackage={onUpdateWorkPackage}
        />
        <WorkPackagePriorityCell
          entry={entry}
          editablePriorities={editablePriorities}
          isLocalEditingEnabled={isLocalEditingEnabled}
          isSaving={isSaving}
          priorityLabels={priorityLabels}
          onUpdateWorkPackage={onUpdateWorkPackage}
        />
        <WorkPackageStatusCell
          entry={entry}
          editableStatuses={editableStatuses}
          isLocalEditingEnabled={isLocalEditingEnabled}
          isSaving={isSaving}
          onUpdateWorkPackage={onUpdateWorkPackage}
        />
        <td>{entry.health !== 'on_track' ? <span className={healthClassNameByValue[entry.health]}>{entry.health}</span> : null}</td>
        <td>{entry.effortPt}</td>
      </tr>
      {hasFeatureSummary && isExpanded ? <WorkPackageDetailRow detailId={detailId} featureSummary={entry.featureSummary} /> : null}
    </React.Fragment>
  );
};
