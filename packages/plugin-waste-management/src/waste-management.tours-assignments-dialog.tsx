import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import type { FormEvent } from 'react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import type { LocationTourLinkFormState } from './waste-management.tours.shared.js';

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
