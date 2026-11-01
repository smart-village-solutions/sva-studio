import { resolveEditorLocale, usePluginTranslation } from '@sva/plugin-sdk';
import { ChevronLeft as IconChevronLeft, ChevronRight as IconChevronRight } from 'lucide-react';
import {
  Badge,
  Calendar,
  buttonVariants,
  cn,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';

const toDateOnly = (year: number, monthIndex: number, day: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const resolveInitialYear = (customDate: string, firstDate: string, endDate: string) => {
  const fallbackCandidate = customDate || firstDate || endDate;
  const candidateYear = fallbackCandidate ? Number(fallbackCandidate.slice(0, 4)) : Number.NaN;
  return Number.isFinite(candidateYear) ? candidateYear : new Date().getFullYear();
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
  const locale = resolveEditorLocale();
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: 'full' });
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const weekdayLabel = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const fullWeekdayLabel = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const selected = Array.from(selectedDates, (value) => {
    const [selectedYear, month, day] = value.split('-').map(Number);
    return new Date(selectedYear!, month! - 1, day!);
  });
  const selectedCount = Array.from(selectedDates).filter(
    (date) => Number(date.slice(0, 4)) === year
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-7xl overflow-hidden p-0">
        <div className="flex h-full max-h-[92vh] flex-col bg-surface-inset">
          <DialogHeader className="border-b border-border/50 px-6 py-5">
            <DialogTitle>{pt('tours.customDates.dialog.title')}</DialogTitle>
            <DialogDescription>{pt('tours.customDates.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-5 sm:px-6">
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => onYearChange(year - 1)}
            >
              <IconChevronLeft strokeWidth={1} aria-hidden="true" className="mr-2 h-4 w-4" />
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
              <IconChevronRight strokeWidth={1} aria-hidden="true" className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-y-auto px-3 pb-4 sm:px-6">
            <Calendar
              mode="multiple"
              selected={selected}
              month={new Date(year, 0, 1)}
              numberOfMonths={12}
              hideNavigation
              disableNavigation
              showOutsideDays={false}
              weekStartsOn={1}
              startMonth={new Date(year, 0, 1)}
              endMonth={new Date(year, 11, 1)}
              disabled={disabled}
              className="w-full bg-transparent p-0"
              classNames={{
                months: 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3',
                month:
                  'min-w-0 space-y-2 rounded-lg border border-border-subtle bg-card p-1 sm:p-3',
                month_caption: 'flex min-h-11 items-center px-2',
                month_grid: 'w-full table-fixed border-collapse',
                weekday: 'h-8 text-center text-xs font-normal text-muted-foreground',
                day: 'h-11 p-0 text-center',
                day_button: cn(
                  buttonVariants({ variant: 'tertiary' }),
                  'h-11 min-h-11 w-full min-w-9 p-0 font-medium'
                ),
              }}
              formatters={{
                formatCaption: (date) => monthLabel.format(date),
                formatWeekdayName: (date) => weekdayLabel.format(date),
              }}
              labels={{
                labelGrid: (date) => monthLabel.format(date),
                labelDayButton: (date) => fullDate.format(date),
                labelWeekday: (date) => fullWeekdayLabel.format(date),
              }}
              onDayClick={(date) =>
                onToggleDate(toDateOnly(date.getFullYear(), date.getMonth(), date.getDate()))
              }
            />
          </div>
          <DialogFooter className="border-t border-border/50 px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {pt('tours.customDates.actions.close')}
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
