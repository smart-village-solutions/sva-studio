import type { WasteCustomTourDate } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconCalendarPlus, IconChevronLeft, IconChevronRight, IconTrash } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
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
  StudioField,
} from '@sva/studio-ui-react';

const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

const formatMonthLabel = (year: number, monthIndex: number) =>
  new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(year, monthIndex, 1));

const toDateOnly = (year: number, monthIndex: number, day: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

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
  firstDate,
  endDate,
  disabled = false,
  onChange,
}: {
  readonly customDates: readonly WasteCustomTourDate[];
  readonly firstDate: string;
  readonly endDate: string;
  readonly disabled?: boolean;
  readonly onChange: (customDates: readonly WasteCustomTourDate[]) => void;
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
  const [year, setYear] = useState(initialYear);

  useEffect(() => {
    setYear(initialYear);
  }, [initialYear]);

  const sortedDates = useMemo(
    () => [...customDates].sort((left, right) => left.date.localeCompare(right.date)),
    [customDates]
  );
  const selectedDates = useMemo(() => new Set(sortedDates.map((entry) => entry.date)), [sortedDates]);

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

  const removeEntry = (date: string) => {
    onChange(sortedDates.filter((entry) => entry.date !== date));
  };

  const toggleDate = (date: string) => {
    if (selectedDates.has(date)) {
      removeEntry(date);
      return;
    }
    onChange([...sortedDates, { date }].sort((left, right) => left.date.localeCompare(right.date)));
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
                <th scope="col" className="px-4 py-3 text-right">{pt('tours.customDates.fields.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedDates.map((entry) => (
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
                  <td className="px-4 py-3 text-right">
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
                  </td>
                </tr>
              ))}
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
