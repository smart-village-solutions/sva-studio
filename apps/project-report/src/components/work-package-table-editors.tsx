import type { EditableMilestoneOption, EditableValueOption } from '../lib/local-editing';
import { t } from '../lib/i18n';
import type { ProjectPriority, ProjectStatus } from '../lib/project-status';
import type { ProjectStatusReport, WorkPackageRow } from '../lib/report-model';
import type { LocalProjectStatusPatchRequest } from '../lib/project-status-api';

const getStatusLabel = (status: ProjectStatus): string => t(`app.statuses.${status}` as const);

const EditableValueCell = <TValue extends string,>({
  ariaLabel,
  disabled,
  isEditable,
  options,
  readOnlyLabel,
  value,
  onChange,
  getOptionLabel,
}: Readonly<{
  ariaLabel: string;
  disabled: boolean;
  isEditable: boolean;
  options: readonly EditableValueOption<TValue>[] | readonly EditableMilestoneOption[];
  readOnlyLabel: string;
  value: TValue;
  onChange: (value: TValue) => void;
  getOptionLabel: (option: TValue | string) => string;
}>) => {
  if (!isEditable) {
    return <>{readOnlyLabel}</>;
  }

  return (
    <select className="table-inline-select" aria-label={ariaLabel} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as TValue)}>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {getOptionLabel(option.id)}
        </option>
      ))}
    </select>
  );
};

export const WorkPackageMilestoneCell = ({
  entry,
  editableMilestones,
  isLocalEditingEnabled,
  isSaving,
  onUpdateWorkPackage,
}: Readonly<{
  entry: WorkPackageRow;
  editableMilestones: readonly EditableMilestoneOption[];
  isLocalEditingEnabled: boolean;
  isSaving: boolean;
  onUpdateWorkPackage: (payload: LocalProjectStatusPatchRequest) => void;
}>) => (
  <td>
    <EditableValueCell
      ariaLabel={t('app.workPackageTable.editMilestoneAriaLabel', { id: entry.id })}
      disabled={isSaving}
      isEditable={isLocalEditingEnabled}
      options={editableMilestones}
      readOnlyLabel={entry.milestoneTitle}
      value={entry.milestoneId}
      getOptionLabel={(value) => editableMilestones.find((milestone) => milestone.id === value)?.label ?? value}
      onChange={(milestoneId) =>
        onUpdateWorkPackage({
          workPackageId: entry.id,
          milestoneId,
          priority: entry.priority,
          status: entry.status,
        })
      }
    />
  </td>
);

export const WorkPackagePriorityCell = ({
  entry,
  editablePriorities,
  isLocalEditingEnabled,
  isSaving,
  priorityLabels,
  onUpdateWorkPackage,
}: Readonly<{
  entry: WorkPackageRow;
  editablePriorities: readonly EditableValueOption<ProjectPriority>[];
  isLocalEditingEnabled: boolean;
  isSaving: boolean;
  priorityLabels: ProjectStatusReport['priorityModel'];
  onUpdateWorkPackage: (payload: LocalProjectStatusPatchRequest) => void;
}>) => (
  <td>
    <EditableValueCell
      ariaLabel={t('app.workPackageTable.editPriorityAriaLabel', { id: entry.id })}
      disabled={isSaving}
      isEditable={isLocalEditingEnabled}
      options={editablePriorities}
      readOnlyLabel={entry.priorityLabel}
      value={entry.priority}
      getOptionLabel={(value) => priorityLabels[value as ProjectPriority]}
      onChange={(priority) =>
        onUpdateWorkPackage({
          workPackageId: entry.id,
          milestoneId: entry.milestoneId,
          priority,
          status: entry.status,
        })
      }
    />
  </td>
);

export const WorkPackageStatusCell = ({
  entry,
  editableStatuses,
  isLocalEditingEnabled,
  isSaving,
  onUpdateWorkPackage,
}: Readonly<{
  entry: WorkPackageRow;
  editableStatuses: readonly EditableValueOption<ProjectStatus>[];
  isLocalEditingEnabled: boolean;
  isSaving: boolean;
  onUpdateWorkPackage: (payload: LocalProjectStatusPatchRequest) => void;
}>) => (
  <td>
    <EditableValueCell
      ariaLabel={t('app.workPackageTable.editStatusAriaLabel', { id: entry.id })}
      disabled={isSaving}
      isEditable={isLocalEditingEnabled}
      options={editableStatuses}
      readOnlyLabel={getStatusLabel(entry.status)}
      value={entry.status}
      getOptionLabel={(value) => getStatusLabel(value as ProjectStatus)}
      onChange={(status) =>
        onUpdateWorkPackage({
          workPackageId: entry.id,
          milestoneId: entry.milestoneId,
          priority: entry.priority,
          status,
        })
      }
    />
  </td>
);
