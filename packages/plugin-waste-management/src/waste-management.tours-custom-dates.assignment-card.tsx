import type { Dispatch, SetStateAction } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconTrash } from '@tabler/icons-react';
import { Button, Textarea } from '@sva/studio-ui-react';
import type { TourDateLocationAssignmentFormState } from './waste-management.tours.types.js';
import type { TourCustomDatePendingDelete } from './waste-management.tours-custom-date-delete-dialogs.js';
import { TourCustomDateLocationPicker } from './waste-management.tours-custom-dates.location-picker.js';

type TourCustomDateAssignmentCardProps = Readonly<{
  readonly assignment: TourDateLocationAssignmentFormState;
  readonly disabled: boolean;
  readonly locations: readonly { id: string; label: string }[];
  readonly locationLabels: ReadonlyMap<string, string>;
  readonly activeLocationPickerId: string | null;
  readonly setActiveLocationPickerId: Dispatch<SetStateAction<string | null>>;
  readonly locationSearchValues: Readonly<Record<string, string>>;
  readonly setLocationSearchValues: Dispatch<SetStateAction<Record<string, string>>>;
  readonly duplicateAssignmentId: string | null;
  readonly updateAssignment: (
    id: string,
    patch: Partial<TourDateLocationAssignmentFormState>
  ) => void;
  readonly setPendingDelete: Dispatch<SetStateAction<TourCustomDatePendingDelete | null>>;
}>;

export const TourCustomDateAssignmentCard = ({
  assignment,
  disabled,
  locations,
  locationLabels,
  activeLocationPickerId,
  setActiveLocationPickerId,
  locationSearchValues,
  setLocationSearchValues,
  duplicateAssignmentId,
  updateAssignment,
  setPendingDelete,
}: TourCustomDateAssignmentCardProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_auto] lg:items-start">
        <TourCustomDateLocationPicker
          assignment={assignment}
          disabled={disabled}
          locations={locations}
          locationLabels={locationLabels}
          activeLocationPickerId={activeLocationPickerId}
          setActiveLocationPickerId={setActiveLocationPickerId}
          locationSearchValues={locationSearchValues}
          setLocationSearchValues={setLocationSearchValues}
          duplicateAssignmentId={duplicateAssignmentId}
          updateAssignment={updateAssignment}
        />
        <div className="space-y-2">
          <label
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            htmlFor={`assignment-note-${assignment.id}`}
          >
            {pt('tours.customDates.fields.note')}
          </label>
          <Textarea
            id={`assignment-note-${assignment.id}`}
            value={assignment.note}
            disabled={disabled}
            rows={3}
            onChange={(event) =>
              updateAssignment(assignment.id, {
                note: event.target.value,
              })
            }
            placeholder={pt('tours.customDates.fields.notePlaceholder')}
          />
        </div>
        <div className="flex justify-end lg:pt-6">
          <Button
            type="button"
            variant="tertiary"
            disabled={disabled}
            className="text-destructive hover:text-destructive"
            onClick={() =>
              setPendingDelete({
                kind: 'assignment',
                assignmentId: assignment.id,
              })
            }
          >
            <IconTrash aria-hidden="true" className="mr-2 h-4 w-4" />
            {pt('tours.customDates.actions.removeAssignment')}
          </Button>
        </div>
      </div>
    </div>
  );
};

type AssignmentPanelProps = Readonly<{
  date: string;
  assignments: readonly TourDateLocationAssignmentFormState[];
  disabled: boolean;
  addAssignment: (date: string) => void;
  locations: readonly { id: string; label: string }[];
  locationLabels: ReadonlyMap<string, string>;
  activeLocationPickerId: string | null;
  setActiveLocationPickerId: Dispatch<SetStateAction<string | null>>;
  locationSearchValues: Readonly<Record<string, string>>;
  setLocationSearchValues: Dispatch<SetStateAction<Record<string, string>>>;
  duplicateAssignmentId: string | null;
  updateAssignment: (id: string, patch: Partial<TourDateLocationAssignmentFormState>) => void;
  setPendingDelete: Dispatch<SetStateAction<TourCustomDatePendingDelete | null>>;
}>;

export const TourCustomDateAssignmentPanel = ({
  date,
  assignments,
  disabled,
  addAssignment,
  locations,
  locationLabels,
  activeLocationPickerId,
  setActiveLocationPickerId,
  locationSearchValues,
  setLocationSearchValues,
  duplicateAssignmentId,
  updateAssignment,
  setPendingDelete,
}: AssignmentPanelProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <tr className="border-t border-border/60 bg-muted/10 align-top">
      <td colSpan={4} className="px-4 py-4">
        <div className="space-y-3 rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {pt('tours.customDates.assignmentSection.title')}
              </p>
              <p className="text-xs text-muted-foreground">
                {pt('tours.customDates.assignmentSection.description')}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => addAssignment(date)}
            >
              {pt('tours.customDates.actions.addAssignment')}
            </Button>
          </div>
          {assignments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {pt('tours.customDates.assignmentSection.empty')}
            </p>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <TourCustomDateAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  disabled={disabled}
                  locations={locations}
                  locationLabels={locationLabels}
                  activeLocationPickerId={activeLocationPickerId}
                  setActiveLocationPickerId={setActiveLocationPickerId}
                  locationSearchValues={locationSearchValues}
                  setLocationSearchValues={setLocationSearchValues}
                  duplicateAssignmentId={duplicateAssignmentId}
                  updateAssignment={updateAssignment}
                  setPendingDelete={setPendingDelete}
                />
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};
