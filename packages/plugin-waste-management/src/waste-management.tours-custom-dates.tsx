import type { WasteCustomTourDate } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconCalendarPlus, IconChevronLeft, IconChevronRight, IconTrash } from '@tabler/icons-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  StudioConfirmDialog,
  Textarea,
} from '@sva/studio-ui-react';

import {
  removeAssignmentsForDeletedDates,
  sortTourDateLocationAssignments,
} from './waste-management.tours.shared.js';
import type { TourDateLocationAssignmentFormState } from './waste-management.tours.types.js';

const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

const formatMonthLabel = (year: number, monthIndex: number) =>
  new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(year, monthIndex, 1));

const toDateOnly = (year: number, monthIndex: number, day: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const normalizeSearchValue = (value: string) => value.trim().toLocaleLowerCase('de-DE');

const resolveInitialYear = (customDate: string, firstDate: string, endDate: string) => {
  const fallbackCandidate = customDate || firstDate || endDate;
  const candidateYear = fallbackCandidate ? Number(fallbackCandidate.slice(0, 4)) : Number.NaN;
  return Number.isFinite(candidateYear) ? candidateYear : new Date().getFullYear();
};

const TourCustomDateMonth = ({
  monthIndex,
  year,
  selectedDates,
  onToggleDate,
}: {
  readonly monthIndex: number;
  readonly year: number;
  readonly selectedDates: ReadonlySet<string>;
  readonly onToggleDate: (date: string) => void;
}) => {
  const first = new Date(year, monthIndex, 1);
  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-shell">
      <h3 className="text-base font-semibold capitalize text-foreground">{formatMonthLabel(year, monthIndex)}</h3>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {weekdayLabels.map((day) => (
          <div key={`${monthIndex}-${day}`}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startWeekday }).map((_, index) => (
          <div key={`empty-${monthIndex}-${index}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
          const date = toDateOnly(year, monthIndex, day);
          const selected = selectedDates.has(date);

          return (
            <button
              key={date}
              type="button"
              className={[
                'aspect-square rounded-xl border text-sm font-medium transition-colors',
                selected
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border/50 bg-background text-foreground hover:border-primary/50 hover:bg-accent/70',
              ].join(' ')}
              aria-pressed={selected}
              onClick={() => onToggleDate(date)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </section>
  );
};

const TourCustomDatesSelectionDialog = ({
  open,
  year,
  selectedDates,
  disabled = false,
  onOpenChange,
  onYearChange,
  onToggleDate,
}: {
  readonly open: boolean;
  readonly year: number;
  readonly selectedDates: ReadonlySet<string>;
  readonly disabled?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onYearChange: (year: number) => void;
  readonly onToggleDate: (date: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const months = Array.from({ length: 12 }, (_, monthIndex) => monthIndex);
  const selectedCount = Array.from(selectedDates).filter((date) => Number(date.slice(0, 4)) === year).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-7xl overflow-hidden p-0">
        <div className="flex h-full max-h-[92vh] flex-col bg-[linear-gradient(180deg,rgba(222,216,193,0.42),rgba(247,246,239,0.96))]">
          <DialogHeader className="border-b border-border/50 px-6 py-5">
            <DialogTitle>{pt('tours.customDates.dialog.title')}</DialogTitle>
            <DialogDescription>{pt('tours.customDates.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-4 px-6 py-5">
            <Button type="button" variant="outline" disabled={disabled} onClick={() => onYearChange(year - 1)}>
              <IconChevronLeft aria-hidden="true" className="mr-2 h-4 w-4" />
              {year - 1}
            </Button>
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl font-semibold tracking-tight text-foreground">{year}</span>
              <Badge variant="outline">{pt('tours.customDates.meta.selectedCount', { value: selectedCount })}</Badge>
            </div>
            <Button type="button" variant="outline" disabled={disabled} onClick={() => onYearChange(year + 1)}>
              {year + 1}
              <IconChevronRight aria-hidden="true" className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-y-auto px-6 pb-4">
            <div className="grid gap-4 pb-2 md:grid-cols-2 xl:grid-cols-4">
              {months.map((monthIndex) => (
                <TourCustomDateMonth
                  key={monthIndex}
                  monthIndex={monthIndex}
                  year={year}
                  selectedDates={selectedDates}
                  onToggleDate={disabled ? () => undefined : onToggleDate}
                />
              ))}
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('tours.actions.cancel')}
            </Button>
            <Button type="button" disabled={disabled} onClick={() => onOpenChange(false)}>
              {pt('tours.customDates.actions.apply')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

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
  readonly onAssignmentsChange: (assignments: readonly TourDateLocationAssignmentFormState[]) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const firstCustomDate = useMemo(
    () =>
      [...customDates]
        .map((entry) => entry.date)
        .sort((left, right) => left.localeCompare(right))[0] ?? '',
    [customDates]
  );
  const initialYear = useMemo(() => resolveInitialYear(firstCustomDate, firstDate, endDate), [endDate, firstCustomDate, firstDate]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeleteDate, setPendingDeleteDate] = useState<string | null>(null);
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
  const selectedDates = useMemo(() => new Set(sortedDates.map((entry) => entry.date)), [sortedDates]);
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
  const locationLabels = useMemo(() => new Map(locations.map((location) => [location.id, location.label])), [locations]);

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
      removeEntry(date);
      return;
    }
    syncDates([...sortedDates, { date }].sort((left, right) => left.date.localeCompare(right.date)));
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

  const updateAssignment = (assignmentId: string, patch: Partial<TourDateLocationAssignmentFormState>) => {
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
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{pt('tours.customDates.description')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={disabled} onClick={() => setDialogOpen(true)}>
            <IconCalendarPlus aria-hidden="true" className="mr-2 h-4 w-4" />
            {pt('tours.customDates.actions.openPicker')}
          </Button>
          {sortedDates.length > 0 ? (
            <Badge variant="outline">{pt('tours.customDates.meta.selectedSummary', { value: sortedDates.length })}</Badge>
          ) : null}
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {pt('tours.customDates.empty')}
        </p>
      ) : (
        <div className="overflow-hidden border border-border/70 bg-card shadow-shell">
          <table className="min-w-full border-collapse">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">{pt('tours.customDates.fields.date')}</th>
                <th scope="col" className="px-4 py-3">{pt('tours.customDates.fields.comment')}</th>
                <th scope="col" className="px-4 py-3">{pt('tours.customDates.fields.assignments')}</th>
                <th scope="col" className="px-4 py-3 text-right">{pt('tours.customDates.fields.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedDates.map((entry) => {
                const assignments = assignmentsByDate.get(entry.date) ?? [];
                const assignmentsOpen = activeAssignmentDate === entry.date;

                return (
                  <Fragment key={entry.date}>
                    <tr key={entry.date} className="border-t border-border/60 align-top">
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
                            {assignments.length === 0
                              ? pt('tours.customDates.assignmentSection.summaryEmpty')
                              : pt('tours.customDates.assignmentSection.summaryCount', { value: assignments.length })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {assignments.length === 0
                              ? pt('tours.customDates.assignmentSection.summaryHintEmpty')
                              : pt('tours.customDates.assignmentSection.summaryHintReady')}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => setActiveAssignmentDate((current) => (current === entry.date ? null : entry.date))}
                          >
                            {assignmentsOpen
                              ? pt('tours.customDates.actions.closeAssignments')
                              : pt('tours.customDates.actions.editAssignments')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={disabled}
                            className="text-destructive hover:text-destructive"
                            onClick={() => setPendingDeleteDate(entry.date)}
                          >
                            <IconTrash aria-hidden="true" className="mr-2 h-4 w-4" />
                            {pt('tours.customDates.actions.removeDate')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {assignmentsOpen ? (
                      <tr className="border-t border-border/60 bg-muted/10 align-top">
                        <td colSpan={4} className="px-4 py-4">
                          <div className="space-y-3 rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">{pt('tours.customDates.assignmentSection.title')}</p>
                                <p className="text-xs text-muted-foreground">
                                  {pt('tours.customDates.assignmentSection.description')}
                                </p>
                              </div>
                              <Button type="button" variant="outline" disabled={disabled} onClick={() => addAssignment(entry.date)}>
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
                                  <div key={assignment.id} className="rounded-2xl border border-border/70 bg-card p-4">
                                    <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_auto] lg:items-start">
                                      <div
                                        className="space-y-2"
                                        onBlur={(event) => {
                                          const nextTarget = event.relatedTarget;
                                          if (nextTarget instanceof HTMLElement && event.currentTarget.contains(nextTarget)) {
                                            return;
                                          }
                                          setActiveLocationPickerId((current) => (current === assignment.id ? null : current));
                                        }}
                                      >
                                        <label
                                          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                                          htmlFor={`assignment-location-${assignment.id}`}
                                        >
                                          {pt('tours.customDates.fields.location')}
                                        </label>
                                        <div className="relative">
                                          <Input
                                            id={`assignment-location-${assignment.id}`}
                                            role="combobox"
                                            aria-autocomplete="list"
                                            aria-expanded={activeLocationPickerId === assignment.id}
                                            aria-controls={`assignment-location-options-${assignment.id}`}
                                            value={
                                              locationSearchValues[assignment.id] ??
                                              locationLabels.get(assignment.locationId) ??
                                              ''
                                            }
                                            disabled={disabled}
                                            onFocus={() => setActiveLocationPickerId(assignment.id)}
                                            onChange={(event) => {
                                              setActiveLocationPickerId(assignment.id);
                                              setLocationSearchValues((current) => ({
                                                ...current,
                                                [assignment.id]: event.target.value,
                                              }));
                                            }}
                                            placeholder={pt('tours.customDates.fields.locationSearchPlaceholder')}
                                          />
                                          {activeLocationPickerId === assignment.id ? (
                                            <div
                                              id={`assignment-location-options-${assignment.id}`}
                                              role="listbox"
                                              className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-border/70 bg-popover p-2 shadow-lg"
                                            >
                                              <button
                                                type="button"
                                                role="option"
                                                className={[
                                                  'flex w-full items-start rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                                  assignment.locationId.length === 0
                                                    ? 'bg-accent text-accent-foreground'
                                                    : 'text-foreground hover:bg-accent/70',
                                                ].join(' ')}
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => {
                                                  setLocationSearchValues((current) => ({
                                                    ...current,
                                                    [assignment.id]: '',
                                                  }));
                                                  setActiveLocationPickerId(null);
                                                  updateAssignment(assignment.id, { locationId: '' });
                                                }}
                                              >
                                                {pt('tours.customDates.fields.locationPlaceholder')}
                                              </button>
                                              {locations
                                                .filter((location) => {
                                                  const query = normalizeSearchValue(
                                                    locationSearchValues[assignment.id] ?? ''
                                                  );
                                                  return query.length === 0
                                                    ? true
                                                    : normalizeSearchValue(location.label).includes(query);
                                                })
                                                .map((location) => (
                                                  <button
                                                    key={location.id}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={assignment.locationId === location.id}
                                                    className={[
                                                      'flex w-full items-start rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                                      assignment.locationId === location.id
                                                        ? 'bg-accent text-accent-foreground'
                                                        : 'text-foreground hover:bg-accent/70',
                                                    ].join(' ')}
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => {
                                                      setLocationSearchValues((current) => ({
                                                        ...current,
                                                        [assignment.id]: location.label,
                                                      }));
                                                      setActiveLocationPickerId(null);
                                                      updateAssignment(assignment.id, { locationId: location.id });
                                                    }}
                                                  >
                                                    {location.label}
                                                  </button>
                                                ))}
                                              {locations.filter((location) => {
                                                const query = normalizeSearchValue(locationSearchValues[assignment.id] ?? '');
                                                return query.length === 0
                                                  ? false
                                                  : normalizeSearchValue(location.label).includes(query);
                                              }).length === 0 &&
                                              normalizeSearchValue(locationSearchValues[assignment.id] ?? '').length > 0 ? (
                                                <p className="px-3 py-2 text-sm text-muted-foreground">
                                                  {pt('tours.customDates.fields.locationSearchEmpty')}
                                                </p>
                                              ) : null}
                                            </div>
                                          ) : null}
                                        </div>
                                        {duplicateAssignmentId === assignment.id ? (
                                          <p className="text-xs text-destructive">{pt('tours.customDates.messages.duplicateLocation')}</p>
                                        ) : null}
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor={`assignment-note-${assignment.id}`}>
                                          {pt('tours.customDates.fields.note')}
                                        </label>
                                        <Textarea
                                          id={`assignment-note-${assignment.id}`}
                                          value={assignment.note}
                                          disabled={disabled}
                                          rows={3}
                                          onChange={(event) => updateAssignment(assignment.id, { note: event.target.value })}
                                          placeholder={pt('tours.customDates.fields.notePlaceholder')}
                                        />
                                      </div>
                                      <div className="flex justify-end lg:pt-6">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          disabled={disabled}
                                          className="text-destructive hover:text-destructive"
                                          onClick={() => removeAssignment(assignment.id)}
                                        >
                                          <IconTrash aria-hidden="true" className="mr-2 h-4 w-4" />
                                          {pt('tours.customDates.actions.removeAssignment')}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
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
      <StudioConfirmDialog
        open={pendingDeleteDate !== null}
        title={pt('tours.customDates.dialog.removeTitle')}
        description={pt('tours.customDates.dialog.removeDescription', { value: pendingDeleteDate ?? '' })}
        confirmLabel={pt('tours.customDates.dialog.removeConfirm')}
        cancelLabel={pt('tours.customDates.dialog.removeCancel')}
        onCancel={() => setPendingDeleteDate(null)}
        onConfirm={() => {
          if (pendingDeleteDate) {
            removeEntry(pendingDeleteDate);
          }
          setPendingDeleteDate(null);
        }}
      />
    </div>
  );
};
