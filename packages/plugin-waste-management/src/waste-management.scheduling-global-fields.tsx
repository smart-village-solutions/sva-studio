import type { WasteTourRecord } from '@sva/plugin-sdk';
import { Checkbox, Input, Select, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';

import { wasteReasonTypeOptions } from './waste-management.scheduling.options.js';
import type { GlobalDateShiftFormState } from './waste-management.scheduling.shared.js';
import { WasteSchedulingTourSelection } from './waste-management.scheduling-tour-selection.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const WasteSchedulingGlobalFields = ({
  form,
  tours,
  pt,
  onChange,
}: {
  readonly form: GlobalDateShiftFormState;
  readonly tours: readonly WasteTourRecord[];
  readonly pt: Translate;
  readonly onChange: (patch: Partial<GlobalDateShiftFormState>) => void;
}) => (
  <StudioFieldGroup>
    <StudioField id="waste-global-shift-original-date" label={pt('scheduling.global.fields.originalDate')}>
      <Input id="waste-global-shift-original-date" type="date" value={form.originalDate} onChange={(event) => onChange({ originalDate: event.target.value })} />
    </StudioField>
    <StudioField id="waste-global-shift-actual-date" label={pt('scheduling.global.fields.actualDate')}>
      <Input id="waste-global-shift-actual-date" type="date" value={form.actualDate} onChange={(event) => onChange({ actualDate: event.target.value })} />
    </StudioField>
    <StudioField id="waste-global-shift-description" label={pt('scheduling.global.fields.description')}>
      <Textarea id="waste-global-shift-description" value={form.description} onChange={(event) => onChange({ description: event.target.value })} />
    </StudioField>
    <StudioField id="waste-global-shift-reason-type" label={pt('scheduling.global.fields.reasonType')}>
      <Select
        id="waste-global-shift-reason-type"
        value={form.reasonType}
        onChange={(event) => onChange({ reasonType: event.target.value as GlobalDateShiftFormState['reasonType'] })}
      >
        <option value="">{pt('scheduling.global.fields.reasonTypeUnset')}</option>
        {wasteReasonTypeOptions.map((reasonType) => (
          <option key={reasonType} value={reasonType}>
            {pt(`scheduling.reasonTypes.${reasonType}`)}
          </option>
        ))}
      </Select>
    </StudioField>
    <StudioField id="waste-global-shift-reason-key" label={pt('scheduling.global.fields.reasonKey')}>
      <Input id="waste-global-shift-reason-key" value={form.reasonKey} onChange={(event) => onChange({ reasonKey: event.target.value })} />
    </StudioField>
    <StudioField id="waste-global-shift-has-year" label={pt('scheduling.global.fields.hasYear')}>
      <div className="flex items-center gap-3">
        <Checkbox id="waste-global-shift-has-year" checked={form.hasYear} onChange={(event) => onChange({ hasYear: event.currentTarget.checked })} />
        <span className="text-sm text-muted-foreground">{form.hasYear ? pt('common.yes') : pt('common.no')}</span>
      </div>
    </StudioField>
    <StudioField id="waste-global-shift-tours" label={pt('scheduling.global.fields.tourIds')}>
      <WasteSchedulingTourSelection
        tours={tours}
        selectedTourIds={form.tourIds}
        pt={pt}
        onChange={(tourIds) => onChange({ tourIds })}
      />
    </StudioField>
  </StudioFieldGroup>
);
