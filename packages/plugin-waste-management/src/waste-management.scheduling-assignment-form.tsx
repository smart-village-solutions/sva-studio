import {
  Checkbox,
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
  Textarea,
} from '@sva/studio-ui-react';

export type WasteTourExplicitAssignmentFormState = Readonly<{
  id: string;
  tourId: string;
  pickupDate: string;
  locationIds: readonly string[];
  note: string;
}>;

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const WasteTourAssignmentLocationsField = ({
  locationIds,
  locationOptions,
  pt,
  onChange,
}: {
  readonly locationIds: readonly string[];
  readonly locationOptions: readonly { readonly id: string; readonly label: string }[];
  readonly pt: Translate;
  readonly onChange: (locationIds: readonly string[]) => void;
}) => (
  <fieldset className="space-y-2" aria-describedby="waste-tour-assignment-locations-hint">
    <legend className="text-sm font-medium">{pt('scheduling.assignments.fields.locations')}</legend>
    <p id="waste-tour-assignment-locations-hint" className="text-sm text-muted-foreground">
      {pt('scheduling.assignments.fields.locationsHint')}
    </p>
    <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
      {locationOptions.map((option) => {
        const checked = locationIds.includes(option.id);
        return (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-muted/40"
          >
            <Checkbox
              checked={checked}
              onChange={(event) =>
                onChange(
                  event.currentTarget.checked
                    ? [...locationIds, option.id]
                    : locationIds.filter((id) => id !== option.id)
                )
              }
            />
            <span className="text-sm">{option.label}</span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

export const WasteTourExplicitAssignmentForm = ({
  form,
  tours,
  locationOptions,
  pt,
  onChange,
}: {
  readonly form: WasteTourExplicitAssignmentFormState;
  readonly tours: readonly { readonly id: string; readonly name: string }[];
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
            {tour.name}
          </option>
        ))}
      </Select>
    </StudioField>
    <StudioField
      id="waste-tour-assignment-pickup-date"
      label={pt('scheduling.assignments.fields.pickupDate')}
    >
      <Input
        id="waste-tour-assignment-pickup-date"
        type="date"
        required
        value={form.pickupDate}
        onChange={(event) => onChange({ pickupDate: event.target.value })}
      />
    </StudioField>
    <WasteTourAssignmentLocationsField
      locationIds={form.locationIds}
      locationOptions={locationOptions}
      pt={pt}
      onChange={(locationIds) => onChange({ locationIds })}
    />
    <StudioField id="waste-tour-assignment-note" label={pt('scheduling.assignments.fields.note')}>
      <Textarea
        id="waste-tour-assignment-note"
        value={form.note}
        onChange={(event) => onChange({ note: event.target.value })}
      />
    </StudioField>
  </StudioFieldGroup>
);
