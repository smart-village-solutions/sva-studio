import {
  DateInput,
  SearchableMultiSelect,
  Select,
  StudioField,
  StudioFieldGroup,
  Textarea,
} from '@sva/studio-ui-react';
import type { WasteTourRecord } from '@sva/waste-management-contracts';
import { formatTourSelectionLabel } from './waste-management.tours.presentation.js';

export type WasteTourExplicitAssignmentFormState = Readonly<{
  id: string;
  tourId: string;
  pickupDate: string;
  locationIds: readonly string[];
  note: string;
}>;

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const WasteTourExplicitAssignmentForm = ({
  form,
  tours,
  locationOptions,
  pt,
  onChange,
}: {
  readonly form: WasteTourExplicitAssignmentFormState;
  readonly tours: readonly WasteTourRecord[];
  readonly locationOptions: readonly { readonly id: string; readonly label: string }[];
  readonly pt: Translate;
  readonly onChange: (patch: Partial<WasteTourExplicitAssignmentFormState>) => void;
}) => (
  <StudioFieldGroup>
    <StudioField id="waste-tour-assignment-tour" label={pt('scheduling.assignments.fields.tour')}>
      <Select
        id="waste-tour-assignment-tour"
        required
        value={form.tourId}
        onChange={(event) => onChange({ tourId: event.target.value })}
      >
        <option value="">{pt('scheduling.assignments.fields.tourUnset')}</option>
        {tours.map((tour) => (
          <option key={tour.id} value={tour.id}>
            {formatTourSelectionLabel(pt, tour)}
          </option>
        ))}
      </Select>
    </StudioField>
    <StudioField
      id="waste-tour-assignment-pickup-date"
      label={pt('scheduling.assignments.fields.pickupDate')}
    >
      <DateInput
        label={pt('scheduling.assignments.fields.pickupDate')}
        id="waste-tour-assignment-pickup-date"
        required
        value={form.pickupDate}
        onValueChange={(value) => onChange({ pickupDate: value })}
      />
    </StudioField>
    <StudioField
      id="waste-tour-assignment-locations"
      label={pt('scheduling.assignments.fields.locations')}
      description={pt('scheduling.assignments.fields.locationsHint')}
    >
      <SearchableMultiSelect
        id="waste-tour-assignment-locations"
        aria-describedby="waste-tour-assignment-locations-description"
        value={form.locationIds}
        options={locationOptions.map(({ id, label }) => ({ value: id, label }))}
        placeholder={pt('scheduling.assignments.fields.chooseLocations')}
        searchLabel={pt('scheduling.assignments.fields.searchLocations')}
        emptyText={pt('scheduling.assignments.fields.noMatchingLocations')}
        unavailableText={pt('scheduling.assignments.fields.unavailableLocation')}
        removeLabel={(label) =>
          pt('scheduling.assignments.fields.removeLocation', { value: label })
        }
        onValueChange={(locationIds) => onChange({ locationIds })}
      />
    </StudioField>
    <StudioField id="waste-tour-assignment-note" label={pt('scheduling.assignments.fields.note')}>
      <Textarea
        id="waste-tour-assignment-note"
        value={form.note}
        onChange={(event) => onChange({ note: event.target.value })}
      />
    </StudioField>
  </StudioFieldGroup>
);
