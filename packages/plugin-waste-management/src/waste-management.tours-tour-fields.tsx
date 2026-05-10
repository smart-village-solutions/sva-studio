import type { WasteFractionRecord } from '@sva/core';
import { Checkbox, Input, Select, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';

import { WasteToursFractionSelection } from './waste-management.tours.fractions.js';
import type { TourFormState } from './waste-management.tours.shared.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const WasteToursTourFields = ({
  form,
  fractions,
  pt,
  onChange,
}: {
  readonly form: TourFormState;
  readonly fractions: readonly WasteFractionRecord[];
  readonly pt: Translate;
  readonly onChange: (patch: Partial<TourFormState>) => void;
}) => (
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
      <WasteToursFractionSelection
        fractions={fractions}
        selectedFractionIds={form.wasteFractionIds}
        pt={pt}
        onChange={(wasteFractionIds) => onChange({ wasteFractionIds })}
      />
    </StudioField>
    <StudioField id="waste-tour-active" label={pt('tours.fields.active')}>
      <div className="flex items-center gap-3">
        <Checkbox id="waste-tour-active" checked={form.active} onChange={(event) => onChange({ active: event.currentTarget.checked })} />
        <span className="text-sm text-muted-foreground">{form.active ? pt('common.active') : pt('common.inactive')}</span>
      </div>
    </StudioField>
  </StudioFieldGroup>
);
