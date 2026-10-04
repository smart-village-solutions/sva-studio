import type { WasteCustomTourDate } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconCalendarPlus } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button } from '@sva/studio-ui-react';

import {
  removeAssignmentsForDeletedDates,
  sortTourDateLocationAssignments,
} from './waste-management.tours.shared.js';
import type { TourDateLocationAssignmentFormState } from './waste-management.tours.types.js';
import {
  resolveInitialYear,
  TourCustomDatesSelectionDialog,
} from './waste-management.tours-custom-dates.calendar.js';
import { TourCustomDatesTable } from './waste-management.tours-custom-dates.table.js';
import {
  type TourCustomDatePendingDelete,
  WasteToursCustomDateDeleteDialog,
} from './waste-management.tours-custom-date-delete-dialogs.js';

export const WasteToursCustomDatesField = ({
  customDates,
  dateLocationAssignments,
  locations,
  firstDate,
  endDate,
  disabled = false,
  onChange,
  onAssignmentsChange,
}: {
  readonly customDates: readonly WasteCustomTourDate[];
  readonly dateLocationAssignments: readonly TourDateLocationAssignmentFormState[];
  readonly locations: readonly { id: string; label: string }[];
  readonly firstDate: string;
  readonly endDate: string;
  readonly disabled?: boolean;
  readonly onChange: (customDates: readonly WasteCustomTourDate[]) => void;
  readonly onAssignmentsChange: (
    assignments: readonly TourDateLocationAssignmentFormState[]
  ) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const feedbackFocusFallbackRef = useRef<HTMLDivElement | null>(null);
  const firstCustomDate = useMemo(
    () =>
      customDates.map((entry) => entry.date).sort((left, right) => left.localeCompare(right))[0] ??
      '',
    [customDates]
  );
  const initialYear = resolveInitialYear(firstCustomDate, firstDate, endDate);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TourCustomDatePendingDelete | null>(null);
  const [duplicateAssignmentId, setDuplicateAssignmentId] = useState<string | null>(null);
  const [activeAssignmentDate, setActiveAssignmentDate] = useState<string | null>(null);
  const [activeLocationPickerId, setActiveLocationPickerId] = useState<string | null>(null);
  const [locationSearchValues, setLocationSearchValues] = useState<Record<string, string>>({});
  const [year, setYear] = useState(initialYear);

  useEffect(() => {
    setYear(initialYear);
  }, [initialYear]);

  const sortedDates = useMemo(
    () => [...customDates].sort((left, right) => left.date.localeCompare(right.date)),
    [customDates]
  );
  const selectedDates = useMemo(
    () => new Set(sortedDates.map((entry) => entry.date)),
    [sortedDates]
  );
  const assignmentsByDate = useMemo(() => {
    const grouped = new Map<string, TourDateLocationAssignmentFormState[]>();

    for (const assignment of sortTourDateLocationAssignments(dateLocationAssignments)) {
      const existing = grouped.get(assignment.pickupDate);
      if (existing) {
        existing.push(assignment);
        continue;
      }
      grouped.set(assignment.pickupDate, [assignment]);
    }

    return grouped;
  }, [dateLocationAssignments]);
  const locationLabels = useMemo(
    () => new Map(locations.map((location) => [location.id, location.label])),
    [locations]
  );

  const updateEntry = (date: string, patch: Partial<WasteCustomTourDate>) => {
    onChange(
      sortedDates.map((entry) =>
        entry.date === date
          ? {
              ...entry,
              ...patch,
            }
          : entry
      )
    );
  };

  const syncDates = (nextDates: readonly WasteCustomTourDate[]) => {
    onChange(nextDates);
    onAssignmentsChange(removeAssignmentsForDeletedDates(dateLocationAssignments, nextDates));
  };

  const removeEntry = (date: string) => {
    setActiveAssignmentDate((current) => (current === date ? null : current));
    syncDates(sortedDates.filter((entry) => entry.date !== date));
  };

  const toggleDate = (date: string) => {
    if (selectedDates.has(date)) {
      setPendingDelete({ kind: 'date', date });
      return;
    }
    syncDates(
      [...sortedDates, { date }].sort((left, right) => left.date.localeCompare(right.date))
    );
  };

  const addAssignment = (pickupDate: string) => {
    onAssignmentsChange(
      sortTourDateLocationAssignments([
        ...dateLocationAssignments,
        {
          id: crypto.randomUUID(),
          pickupDate,
          locationId: '',
          note: '',
        },
      ])
    );
  };

  const updateAssignment = (
    assignmentId: string,
    patch: Partial<TourDateLocationAssignmentFormState>
  ) => {
    const currentAssignment = dateLocationAssignments.find((entry) => entry.id === assignmentId);
    if (!currentAssignment) {
      return;
    }

    const nextAssignment = {
      ...currentAssignment,
      ...patch,
    };

    const locationId = nextAssignment.locationId.trim();
    if (locationId.length > 0) {
      const hasDuplicate = dateLocationAssignments.some(
        (entry) =>
          entry.id !== assignmentId &&
          entry.pickupDate === nextAssignment.pickupDate &&
          entry.locationId.trim() === locationId
      );

      if (hasDuplicate) {
        setDuplicateAssignmentId(assignmentId);
        return;
      }
    }

    setDuplicateAssignmentId((current) => (current === assignmentId ? null : current));
    onAssignmentsChange(
      sortTourDateLocationAssignments(
        dateLocationAssignments.map((entry) => (entry.id === assignmentId ? nextAssignment : entry))
      )
    );
  };

  const removeAssignment = (assignmentId: string) => {
    setDuplicateAssignmentId((current) => (current === assignmentId ? null : current));
    setActiveLocationPickerId((current) => (current === assignmentId ? null : current));
    onAssignmentsChange(dateLocationAssignments.filter((entry) => entry.id !== assignmentId));
  };

  return (
    <div
      ref={feedbackFocusFallbackRef}
      role="region"
      tabIndex={-1}
      aria-label={pt('tours.customDates.title')}
      className="space-y-4"
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{pt('tours.customDates.description')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => setDialogOpen(true)}
          >
            <IconCalendarPlus aria-hidden="true" className="mr-2 h-4 w-4" />
            {pt('tours.customDates.actions.openPicker')}
          </Button>
          {sortedDates.length > 0 ? (
            <Badge variant="outline">
              {pt('tours.customDates.meta.selectedSummary', { value: sortedDates.length })}
            </Badge>
          ) : null}
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {pt('tours.customDates.empty')}
        </p>
      ) : (
        <TourCustomDatesTable
          sortedDates={sortedDates}
          assignmentsByDate={assignmentsByDate}
          activeAssignmentDate={activeAssignmentDate}
          setActiveAssignmentDate={setActiveAssignmentDate}
          disabled={disabled}
          updateEntry={updateEntry}
          setPendingDelete={setPendingDelete}
          addAssignment={addAssignment}
          locations={locations}
          locationLabels={locationLabels}
          activeLocationPickerId={activeLocationPickerId}
          setActiveLocationPickerId={setActiveLocationPickerId}
          locationSearchValues={locationSearchValues}
          setLocationSearchValues={setLocationSearchValues}
          duplicateAssignmentId={duplicateAssignmentId}
          updateAssignment={updateAssignment}
        />
      )}

      <TourCustomDatesSelectionDialog
        open={dialogOpen}
        year={year}
        selectedDates={selectedDates}
        disabled={disabled}
        onOpenChange={setDialogOpen}
        onYearChange={setYear}
        onToggleDate={toggleDate}
      />
      <WasteToursCustomDateDeleteDialog
        pendingDelete={pendingDelete}
        assignments={dateLocationAssignments}
        locationLabels={locationLabels}
        fallbackFocusRef={feedbackFocusFallbackRef}
        onCancel={() => setPendingDelete(null)}
        onConfirm={(request) => {
          if (request.kind === 'date') removeEntry(request.date);
          else removeAssignment(request.assignmentId);
          setPendingDelete(null);
        }}
      />
    </div>
  );
};
