import { Fragment, type Dispatch, type SetStateAction } from 'react';
import type { WasteCustomTourDate } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconTrash } from '@tabler/icons-react';
import { Button, Input } from '@sva/studio-ui-react';
import type { TourDateLocationAssignmentFormState } from './waste-management.tours.types.js';
import type { TourCustomDatePendingDelete } from './waste-management.tours-custom-date-delete-dialogs.js';
import { TourCustomDateAssignmentPanel } from './waste-management.tours-custom-dates.assignment-card.js';

type MainRowProps = Readonly<{
  entry: WasteCustomTourDate;
  assignmentCount: number;
  assignmentsOpen: boolean;
  disabled: boolean;
  updateEntry: (date: string, patch: Partial<WasteCustomTourDate>) => void;
  setPendingDelete: Dispatch<SetStateAction<TourCustomDatePendingDelete | null>>;
  setActiveAssignmentDate: Dispatch<SetStateAction<string | null>>;
}>;

const TourCustomDateMainRow = ({
  entry,
  assignmentCount,
  assignmentsOpen,
  disabled,
  updateEntry,
  setPendingDelete,
  setActiveAssignmentDate,
}: MainRowProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <tr className="border-t border-border/60 align-top">
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-foreground">{entry.date}</span>
      </td>
      <td className="px-4 py-3">
        <Input
          id={`waste-tour-custom-date-${entry.date}`}
          value={entry.description ?? ''}
          disabled={disabled}
          onChange={(event) => updateEntry(entry.date, { description: event.target.value })}
          placeholder={pt('tours.customDates.fields.commentPlaceholder')}
        />
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {assignmentCount === 0
              ? pt('tours.customDates.assignmentSection.summaryEmpty')
              : pt('tours.customDates.assignmentSection.summaryCount', {
                  value: assignmentCount,
                })}
          </p>
          <p className="text-xs text-muted-foreground">
            {assignmentCount === 0
              ? pt('tours.customDates.assignmentSection.summaryHintEmpty')
              : pt('tours.customDates.assignmentSection.summaryHintReady')}
          </p>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() =>
              setActiveAssignmentDate((current) => (current === entry.date ? null : entry.date))
            }
          >
            {assignmentsOpen
              ? pt('tours.customDates.actions.closeAssignments')
              : pt('tours.customDates.actions.editAssignments')}
          </Button>
          <Button
            type="button"
            variant="tertiary"
            disabled={disabled}
            className="text-destructive hover:text-destructive"
            onClick={() => setPendingDelete({ kind: 'date', date: entry.date })}
          >
            <IconTrash aria-hidden="true" className="mr-2 h-4 w-4" />
            {pt('tours.customDates.actions.removeDate')}
          </Button>
        </div>
      </td>
    </tr>
  );
};

type TableProps = Readonly<{
  readonly sortedDates: readonly WasteCustomTourDate[];
  readonly assignmentsByDate: ReadonlyMap<string, readonly TourDateLocationAssignmentFormState[]>;
  readonly activeAssignmentDate: string | null;
  readonly setActiveAssignmentDate: Dispatch<SetStateAction<string | null>>;
  readonly disabled: boolean;
  readonly updateEntry: (date: string, patch: Partial<WasteCustomTourDate>) => void;
  readonly setPendingDelete: Dispatch<SetStateAction<TourCustomDatePendingDelete | null>>;
  readonly addAssignment: (date: string) => void;
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
}>;

export const TourCustomDatesTable = ({
  sortedDates,
  assignmentsByDate,
  activeAssignmentDate,
  setActiveAssignmentDate,
  disabled,
  updateEntry,
  setPendingDelete,
  addAssignment,
  locations,
  locationLabels,
  activeLocationPickerId,
  setActiveLocationPickerId,
  locationSearchValues,
  setLocationSearchValues,
  duplicateAssignmentId,
  updateAssignment,
}: TableProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="overflow-hidden border border-border/70 bg-card shadow-shell">
      <table className="min-w-full border-collapse">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">
              {pt('tours.customDates.fields.date')}
            </th>
            <th scope="col" className="px-4 py-3">
              {pt('tours.customDates.fields.comment')}
            </th>
            <th scope="col" className="px-4 py-3">
              {pt('tours.customDates.fields.assignments')}
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              {pt('tours.customDates.fields.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedDates.map((entry) => {
            const assignments = assignmentsByDate.get(entry.date) ?? [];
            const assignmentsOpen = activeAssignmentDate === entry.date;

            return (
              <Fragment key={entry.date}>
                <TourCustomDateMainRow
                  entry={entry}
                  assignmentCount={assignments.length}
                  assignmentsOpen={assignmentsOpen}
                  disabled={disabled}
                  updateEntry={updateEntry}
                  setPendingDelete={setPendingDelete}
                  setActiveAssignmentDate={setActiveAssignmentDate}
                />
                {assignmentsOpen ? (
                  <TourCustomDateAssignmentPanel
                    date={entry.date}
                    assignments={assignments}
                    disabled={disabled}
                    addAssignment={addAssignment}
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
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
