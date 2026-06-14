import { Input, Select, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';

export type WasteSchadstoffmobilAssignmentFormState = Readonly<{
  id: string;
  pickupDate: string;
  locationId: string;
  note: string;
}>;

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const WasteSchadstoffmobilAssignmentForm = ({
  form,
  locationOptions,
  pt,
  onChange,
}: {
  readonly form: WasteSchadstoffmobilAssignmentFormState;
  readonly locationOptions: readonly { readonly id: string; readonly label: string }[];
  readonly pt: Translate;
  readonly onChange: (patch: Partial<WasteSchadstoffmobilAssignmentFormState>) => void;
}) => (
  <StudioFieldGroup>
    <StudioField id="waste-schadstoffmobil-pickup-date" label={pt('scheduling.schadstoffmobil.fields.pickupDate')}>
      <Input
        id="waste-schadstoffmobil-pickup-date"
        type="date"
        required
        value={form.pickupDate}
        onChange={(event) => onChange({ pickupDate: event.target.value })}
      />
    </StudioField>
    <StudioField id="waste-schadstoffmobil-location" label={pt('scheduling.schadstoffmobil.fields.location')}>
      <Select
        id="waste-schadstoffmobil-location"
        required
        value={form.locationId}
        onChange={(event) => onChange({ locationId: event.target.value })}
      >
        <option value="">{pt('scheduling.schadstoffmobil.fields.locationUnset')}</option>
        {locationOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
    </StudioField>
    <StudioField id="waste-schadstoffmobil-note" label={pt('scheduling.schadstoffmobil.fields.note')}>
      <Textarea
        id="waste-schadstoffmobil-note"
        required
        value={form.note}
        onChange={(event) => onChange({ note: event.target.value })}
      />
    </StudioField>
  </StudioFieldGroup>
);
