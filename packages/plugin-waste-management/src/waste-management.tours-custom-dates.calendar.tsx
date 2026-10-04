import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';

const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

const formatMonthLabel = (year: number, monthIndex: number) =>
  new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(year, monthIndex, 1));

const toDateOnly = (year: number, monthIndex: number, day: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const resolveInitialYear = (customDate: string, firstDate: string, endDate: string) => {
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
      <h3 className="text-base font-semibold capitalize text-foreground">
        {formatMonthLabel(year, monthIndex)}
      </h3>
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

type TourCustomDatesSelectionDialogProps = Readonly<{
  readonly open: boolean;
  readonly year: number;
  readonly selectedDates: ReadonlySet<string>;
  readonly disabled?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onYearChange: (year: number) => void;
  readonly onToggleDate: (date: string) => void;
}>;

export const TourCustomDatesSelectionDialog = ({
  open,
  year,
  selectedDates,
  disabled = false,
  onOpenChange,
  onYearChange,
  onToggleDate,
}: TourCustomDatesSelectionDialogProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const months = Array.from({ length: 12 }, (_, monthIndex) => monthIndex);
  const selectedCount = Array.from(selectedDates).filter(
    (date) => Number(date.slice(0, 4)) === year
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-7xl overflow-hidden p-0">
        <div className="flex h-full max-h-[92vh] flex-col bg-[linear-gradient(180deg,rgba(222,216,193,0.42),rgba(247,246,239,0.96))]">
          <DialogHeader className="border-b border-border/50 px-6 py-5">
            <DialogTitle>{pt('tours.customDates.dialog.title')}</DialogTitle>
            <DialogDescription>{pt('tours.customDates.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-4 px-6 py-5">
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => onYearChange(year - 1)}
            >
              <IconChevronLeft aria-hidden="true" className="mr-2 h-4 w-4" />
              {year - 1}
            </Button>
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl font-semibold tracking-tight text-foreground">{year}</span>
              <Badge variant="outline">
                {pt('tours.customDates.meta.selectedCount', { value: selectedCount })}
              </Badge>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => onYearChange(year + 1)}
            >
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
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
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
