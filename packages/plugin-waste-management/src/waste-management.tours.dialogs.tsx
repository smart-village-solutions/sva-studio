import type { WasteFractionRecord, WasteTourRecord } from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
  Textarea,
} from '@sva/studio-ui-react';
import { useEffect, useState, type FormEvent } from 'react';

import type { WasteManagementSchedulingOverview } from './waste-management.api.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { calculateTourOccurrencesForYear } from './waste-management.tours.presentation.js';
import type { LocationTourLinkFormState, TourFormState } from './waste-management.tours.shared.js';

export const TourDialog = ({
  open,
  mode,
  form,
  fractions,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: TourFormState;
  readonly fractions: readonly WasteFractionRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<TourFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('tours.dialog.createTitle') : pt('tours.dialog.editTitle')}</DialogTitle>
          <DialogDescription>{mode === 'create' ? pt('tours.dialog.createDescription') : pt('tours.dialog.editDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-tour-name" label={pt('tours.fields.name')}>
              <Input id="waste-tour-name" value={form.name} onChange={(event) => onChange({ name: event.target.value })} />
            </StudioField>
            <StudioField id="waste-tour-description" label={pt('tours.fields.description')}>
              <Textarea id="waste-tour-description" value={form.description} onChange={(event) => onChange({ description: event.target.value })} />
            </StudioField>
            <StudioField id="waste-tour-recurrence" label={pt('tours.fields.recurrence')}>
              <Select id="waste-tour-recurrence" value={form.recurrence} onChange={(event) => onChange({ recurrence: event.target.value as TourFormState['recurrence'] })}>
                <option value="">{pt('tours.fields.recurrenceUnset')}</option>
                <option value="weekly">{pt('tours.recurrence.weekly')}</option>
                <option value="biweekly">{pt('tours.recurrence.biweekly')}</option>
                <option value="fourweekly">{pt('tours.recurrence.fourweekly')}</option>
                <option value="yearly">{pt('tours.recurrence.yearly')}</option>
                <option value="on-demand">{pt('tours.recurrence.onDemand')}</option>
                <option value="custom">{pt('tours.recurrence.custom')}</option>
              </Select>
            </StudioField>
            <StudioField id="waste-tour-first-date" label={pt('tours.fields.firstDate')}>
              <Input id="waste-tour-first-date" type="date" value={form.firstDate} onChange={(event) => onChange({ firstDate: event.target.value })} />
            </StudioField>
            <StudioField id="waste-tour-end-date" label={pt('tours.fields.endDate')}>
              <Input id="waste-tour-end-date" type="date" value={form.endDate} onChange={(event) => onChange({ endDate: event.target.value })} />
            </StudioField>
            <StudioField id="waste-tour-custom-dates" label={pt('tours.fields.customDates')}>
              <Textarea
                id="waste-tour-custom-dates"
                value={form.customDatesText}
                onChange={(event) => onChange({ customDatesText: event.target.value })}
                placeholder={pt('tours.fields.customDatesPlaceholder')}
              />
            </StudioField>
            <StudioField id="waste-tour-fractions" label={pt('tours.fields.wasteFractions')}>
              <div className="space-y-2 rounded-md border border-border/70 p-3">
                {fractions.length ? (
                  fractions.map((fraction) => {
                    const checked = form.wasteFractionIds.includes(fraction.id);
                    return (
                      <label key={fraction.id} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={checked}
                          onChange={(event) =>
                            onChange({
                              wasteFractionIds: event.currentTarget.checked
                                ? [...form.wasteFractionIds, fraction.id]
                                : form.wasteFractionIds.filter((value) => value !== fraction.id),
                            })
                          }
                        />
                        <span>{fraction.name}</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">{pt('tours.fields.noFractionsAvailable')}</p>
                )}
              </div>
            </StudioField>
            <StudioField id="waste-tour-active" label={pt('tours.fields.active')}>
              <div className="flex items-center gap-3">
                <Checkbox id="waste-tour-active" checked={form.active} onChange={(event) => onChange({ active: event.currentTarget.checked })} />
                <span className="text-sm text-muted-foreground">{form.active ? pt('common.active') : pt('common.inactive')}</span>
              </div>
            </StudioField>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{pt('tours.actions.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? pt('tours.actions.saving') : mode === 'create' ? pt('tours.actions.create') : pt('tours.actions.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const TourAssignmentsDialog = ({
  open,
  mode,
  form,
  tour,
  locations,
  tours,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: LocationTourLinkFormState;
  readonly tour: WasteTourRecord | null;
  readonly locations: readonly { id: string; label: string }[];
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<LocationTourLinkFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('tours.assignments.dialog.createTitle') : pt('tours.assignments.dialog.editTitle')}</DialogTitle>
          <DialogDescription>{tour ? pt('tours.assignments.dialog.description', { value: tour.name }) : pt('tours.assignments.dialog.descriptionFallback')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-tour-link-tour-id" label={pt('tours.assignments.fields.tourId')}>
              <Select id="waste-tour-link-tour-id" value={form.tourId} onChange={(event) => onChange({ tourId: event.target.value })}>
                <option value="">{pt('tours.assignments.fields.tourUnset')}</option>
                {tours.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-tour-link-location-id" label={pt('tours.assignments.fields.locationId')}>
              <Select id="waste-tour-link-location-id" value={form.locationId} onChange={(event) => onChange({ locationId: event.target.value })}>
                <option value="">{pt('tours.assignments.fields.locationUnset')}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-tour-link-start-date" label={pt('tours.assignments.fields.startDate')}>
              <Input id="waste-tour-link-start-date" type="date" value={form.startDate} onChange={(event) => onChange({ startDate: event.target.value })} />
            </StudioField>
            <StudioField id="waste-tour-link-end-date" label={pt('tours.assignments.fields.endDate')}>
              <Input id="waste-tour-link-end-date" type="date" value={form.endDate} onChange={(event) => onChange({ endDate: event.target.value })} />
            </StudioField>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{pt('tours.assignments.actions.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? pt('tours.assignments.actions.saving') : mode === 'create' ? pt('tours.assignments.actions.create') : pt('tours.assignments.actions.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const TourYearCalendarDialog = ({
  open,
  tour,
  scheduling,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly tour: WasteTourRecord | null;
  readonly scheduling: WasteManagementSchedulingOverview | null;
  readonly onOpenChange: (open: boolean) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  useEffect(() => {
    if (open) {
      setYear(currentYear);
    }
  }, [open, currentYear]);

  const dates = tour && scheduling ? calculateTourOccurrencesForYear(tour, year, scheduling) : [];
  const months = Array.from({ length: 12 }, (_, monthIndex) => {
    const first = new Date(year, monthIndex, 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const highlighted = new Set(
      dates.filter((value) => Number(value.slice(5, 7)) === monthIndex + 1).map((value) => Number(value.slice(8, 10)))
    );
    return { monthIndex, startWeekday, daysInMonth, highlighted };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{pt('tours.yearCalendar.title')}</DialogTitle>
          <DialogDescription>{tour ? pt('tours.yearCalendar.description', { value: tour.name }) : pt('tours.yearCalendar.descriptionFallback')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={() => setYear((current) => current - 1)}>{pt('tours.yearCalendar.actions.previousYear')}</Button>
          <Badge>{pt('tours.yearCalendar.meta.year', { value: year })}</Badge>
          <Button type="button" variant="outline" onClick={() => setYear((current) => current + 1)}>{pt('tours.yearCalendar.actions.nextYear')}</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {months.map((month) => (
            <section key={month.monthIndex} className="space-y-2 rounded-lg border border-border/70 p-3">
              <h3 className="text-sm font-semibold">{new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(year, month.monthIndex, 1))}</h3>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
                  <div key={`${month.monthIndex}-${day}`}>{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {Array.from({ length: month.startWeekday }).map((_, index) => (
                  <div key={`empty-${month.monthIndex}-${index}`} />
                ))}
                {Array.from({ length: month.daysInMonth }, (_, index) => index + 1).map((day) => {
                  const active = month.highlighted.has(day);
                  return (
                    <div key={`${month.monthIndex}-${day}`} className={`rounded px-1 py-2 ${active ? 'bg-primary text-primary-foreground' : 'border border-border/50'}`}>
                      {day}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{pt('tours.yearCalendar.meta.dateListTitle')}</p>
          <div className="flex flex-wrap gap-2">
            {dates.length ? dates.map((date) => <Badge key={date} variant="outline">{date}</Badge>) : <p className="text-sm text-muted-foreground">{pt('tours.yearCalendar.meta.noDates')}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
