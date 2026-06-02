import { t } from '../lib/i18n';
import type { ProjectStatusReport, WorkPackageRow } from '../lib/report-model';
import type { LocalProjectStatusPatchRequest } from '../lib/project-status-api';
import type { EditableMilestoneOption, EditableValueOption } from '../lib/local-editing';
import type { ProjectPriority, ProjectStatus } from '../lib/project-status';
import { WorkPackageTableRow } from './work-package-table-row';

export const WorkPackageTable = ({
  rows,
  isLocalEditingEnabled,
  isSaving,
  editableMilestones,
  editableStatuses,
  editablePriorities,
  priorityLabels,
  onUpdateWorkPackage,
}: Readonly<{
  rows: readonly WorkPackageRow[];
  isLocalEditingEnabled: boolean;
  isSaving: boolean;
  editableMilestones: readonly EditableMilestoneOption[];
  editableStatuses: readonly EditableValueOption<ProjectStatus>[];
  editablePriorities: readonly EditableValueOption<ProjectPriority>[];
  priorityLabels: ProjectStatusReport['priorityModel'];
  onUpdateWorkPackage: (payload: LocalProjectStatusPatchRequest) => void;
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
          <WorkPackageTableRow
            key={entry.id}
            entry={entry}
            isLocalEditingEnabled={isLocalEditingEnabled}
            isSaving={isSaving}
            editableMilestones={editableMilestones}
            editableStatuses={editableStatuses}
            editablePriorities={editablePriorities}
            priorityLabels={priorityLabels}
            onUpdateWorkPackage={onUpdateWorkPackage}
          />
        ))}
      </tbody>
    </table>
  </div>
);
